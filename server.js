import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { TRACKS } from "./tracks.js";

const app = express();
app.use(cors()); // OK för test
app.use(express.json({ limit: "64kb" }));

const PORT = process.env.PORT || 3000;

/**
 * In-memory state per track:
 * tracks[trackId] = {
 *   players: Map(cid -> { x,y,vx,vy, ts, ready }),
 *   startAtEpochMs: number|null,
 *   sse: Map(cid -> res),
 *   ws:  Map(cid -> ws),
 * }
 */
const tracks = new Map();
const TTL_MS = 60000;

function nowMs() { return Date.now(); }

function getTrack(trackId) {
  if (!tracks.has(trackId)) {
	tracks.set(trackId, {
	  players: new Map(),
	  startAtEpochMs: null,
	  winnerCid: null,              // ✅ NYTT
	  sse: new Map(),
	  ws: new Map(),
	  _broadcastTimer: null,
	});
  }
  return tracks.get(trackId);
}

function cleanup(track) {
  const t = nowMs();

  for (const [cid, p] of track.players.entries()) {
    if (t - (p.ts || 0) > TTL_MS) {
      track.players.delete(cid);

      const sseRes = track.sse.get(cid);
      if (sseRes) {
        try { sseRes.end(); } catch {}
        track.sse.delete(cid);
      }

      const ws = track.ws.get(cid);
      if (ws) {
        try { ws.close(); } catch {}
        track.ws.delete(cid);
      }
    }
  }

  // Om <2 spelare kvar: nolla start och ready
	if (track.players.size < 2) {
	  track.startAtEpochMs = null;
	  track.winnerCid = null; // ✅ NYTT
	  for (const p of track.players.values()) {
		p.ready = false;
		p.finishedAtEpochMs = null; // ✅ NYTT
	  }
	}
}

function opponentOf(track, cid) {
  for (const [k, v] of track.players.entries()) {
    if (k !== cid) return { cid: k, p: v };
  }
  return null;
}

/* =========================
   Track geometry + finish verify (server-side)
========================= */

const FINISH_VERIFY_PLAYER_R_W = 16;     // matcha klientens PLAYER_R_W
const FINISH_VERIFY_EPS_W = 2.5;         // lite tolerans

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function getTrackDef(trackId) {
  const t = TRACKS.find(x => String(x.id) === String(trackId));
  return t || null;
}

function normalizeSegments(rawSegments) {
  const out = [];
  for (const s of (rawSegments || [])) {
    if (typeof s === "string") {
      const parts = s.trim().split(/\s+/);
      const word = parts[0]?.toLowerCase();
      const val = Number(parts[1]);
      if (word === "straight") out.push({ type: "line", len: val });
      continue;
    }
    if (!s || typeof s !== "object") continue;

    const t = String(s.type || "").toLowerCase();

    if (t === "straight") { out.push({ type: "line", len: Number(s.len) }); continue; }

    if (t === "left" || t === "right") {
      const sign = t === "right" ? +1 : -1;
      const a = (s.a !== undefined)
        ? sign * Math.abs(Number(s.a))
        : sign * (Number(s.deg ?? 0) * Math.PI / 180);
      out.push({ type: "arc", r: Number(s.r), a });
      continue;
    }

    if (t === "line") { out.push({ type: "line", len: Number(s.len) }); continue; }
    if (t === "arc")  { out.push({ type: "arc",  r: Number(s.r), a: Number(s.a) }); continue; }
  }
  return out;
}

function estimateTrackLengthW(track) {
  const segs = normalizeSegments(track.segments || []);
  let total = 0;
  for (const s of segs) {
    if (s.type === "line") total += Math.max(0, Number(s.len) || 0);
    else if (s.type === "arc") total += Math.abs(Number(s.a) || 0) * Math.max(0, Number(s.r) || 0);
  }
  return total;
}

// Bygger bara sista mållinje-segmentet (finishX/Y + tangent) på samma sätt som klienten.
// Returnerar { finishX, finishY, finishTX, finishTY, trackW, worldW, worldH } eller null.
function buildFinishGeom(trackId) {
  const def = getTrackDef(trackId);
  if (!def) return null;

  const WORLD_W = Number(def.worldW || 800);
  const TRACK_W = Number(def.trackW || 220);

  const baseH = Number(def.worldH || 10000);
  const estLen = estimateTrackLengthW(def);

  // samma logik som du kör på klienten (legacy + finish-safe)
  const legacyWorldH = Math.max(baseH, Math.ceil(estLen + 800));
  const SHIP_OFFSET_W = 1000;     // matcha klientens SHIP_OFFSET_W
  const FINISH_MARGIN_W = 200;
  const minWorldHForFinish = estLen + 200 + SHIP_OFFSET_W + FINISH_MARGIN_W;
  const WORLD_H = Math.max(legacyWorldH, Math.ceil(minWorldHForFinish));

  // === buildTrack() ===
  const STEP = 10;
  const segs = normalizeSegments(def.segments || []);
  const pts = [];

  let x = WORLD_W / 2;
  let y = WORLD_H - 200;
  let heading = -Math.PI / 2;
  pts.push({ x, y });

  function addLine(len) {
    const n = Math.max(1, Math.floor(len / STEP));
    const dl = len / n;
    for (let i = 0; i < n; i++) {
      x += Math.cos(heading) * dl;
      y += Math.sin(heading) * dl;
      pts.push({ x, y });
    }
  }

  function addArc(r, a) {
    const R = Math.max(30, r);
    const sign = Math.sign(a) || 1;
    const cx = x + Math.cos(heading + sign * Math.PI / 2) * R;
    const cy = y + Math.sin(heading + sign * Math.PI / 2) * R;
    let ang = Math.atan2(y - cy, x - cx);

    const arcLen = Math.abs(a) * R;
    const n = Math.max(1, Math.floor(arcLen / STEP));
    const da = a / n;

    for (let i = 0; i < n; i++) {
      ang += da;
      x = cx + Math.cos(ang) * R;
      y = cy + Math.sin(ang) * R;
      heading += da;
      pts.push({ x, y });
    }
  }

  for (const s of segs) {
    if (s.type === "line") addLine(Number(s.len) || 0);
    else if (s.type === "arc") addArc(Number(s.r) || 0, Number(s.a) || 0);
  }

  // clamp X only
  for (const p of pts) {
    p.x = clamp(p.x, TRACK_W * 0.5 + 8, WORLD_W - TRACK_W * 0.5 - 8);
  }

  const end = pts[pts.length - 1];
  let prev = pts[Math.max(0, pts.length - 2)];
  for (let k = pts.length - 2; k >= 0; k--) {
    const cand = pts[k];
    if (Math.hypot(end.x - cand.x, end.y - cand.y) > 0.001) { prev = cand; break; }
  }

  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;

  return {
    finishX: end.x,
    finishY: end.y,
    finishTX: dx / len,
    finishTY: dy / len,
    trackW: TRACK_W,
    worldW: WORLD_W,
    worldH: WORLD_H,
  };
}

// dist point to segment
function distPointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const abLen2 = abx * abx + aby * aby || 1;

  let t = (apx * abx + apy * aby) / abLen2;
  t = clamp(t, 0, 1);

  const cx = ax + abx * t;
  const cy = ay + aby * t;

  return Math.hypot(px - cx, py - cy);
}

const finishGeomCache = new Map(); // trackId -> geom
function getFinishGeom(trackId) {
  const key = String(trackId);
  if (finishGeomCache.has(key)) return finishGeomCache.get(key);
  const g = buildFinishGeom(key);
  finishGeomCache.set(key, g);
  return g;
}

// verifiera finish-claim: {x,y} nära mållinje
function verifyFinishClaim(trackId, x, y) {
  const g = getFinishGeom(trackId);
  if (!g) return { ok: false, err: "unknown_track" };

  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return { ok: false, err: "bad_xy" };

  // bygg segmentet tvärs över banan (samma som klient)
  const nx = -g.finishTY;
  const ny =  g.finishTX;

  const half = g.trackW / 2;

  const ax = g.finishX - nx * half;
  const ay = g.finishY - ny * half;
  const bx = g.finishX + nx * half;
  const by = g.finishY + ny * half;

  const d = distPointToSegment(px, py, ax, ay, bx, by);
  const thr = FINISH_VERIFY_PLAYER_R_W + FINISH_VERIFY_EPS_W;

  return { ok: d <= thr, d, thr };
}

/* =========================
   SSE helpers
========================= */
function sseSend(res, event, dataObj) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
}

/* =========================
   WS helpers
========================= */
function wsSafeSend(ws, obj) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(obj)); } catch {}
}

function startWsBroadcastLoop(trackId) {
  const tr = getTrack(trackId);
  if (tr._broadcastTimer) return;

  const HZ = 15; // 10–20 är lagom
  const PERIOD = Math.floor(1000 / HZ);

  tr._broadcastTimer = setInterval(() => {
    cleanup(tr);
    if (tr.ws.size === 0) return;

    const t = nowMs();
    const players = [];
    let readyCount = 0;

    for (const [cid, p] of tr.players.entries()) {
      if (p.ready) readyCount++;
      players.push({
        cid,
        x: p.x || 0,
        y: p.y || 0,
        vx: p.vx || 0,
        vy: p.vy || 0,
        ts: p.ts || 0,
        ready: !!p.ready,
		finishedAtEpochMs: p.finishedAtEpochMs ?? null,
      });
    }

    const pkt = {
      type: "snapshot",
      track: trackId,
      serverNowMs: t,
      startAtEpochMs: tr.startAtEpochMs,
	  winnerCid: tr.winnerCid ?? null,
      players,
      playersCount: tr.players.size,
      readyCount,
    };

    for (const [cid, ws] of tr.ws.entries()) {
      wsSafeSend(ws, pkt);
    }
  }, PERIOD);
}

function maybeArmStart(tr) {
  if (Number.isFinite(tr.startAtEpochMs)) return;

  // kräver minst 2 spelare och att alla är ready
  if (tr.players.size < 2) return;

  let allReady = true;
  for (const p of tr.players.values()) {
    if (!p.ready) { allReady = false; break; }
  }
  if (!allReady) return;

  // marginal: 2.5–3.5s (du körde 3.5 innan, bra)
  tr.startAtEpochMs = nowMs() + 3500;

  // pusha start event till SSE
  for (const res2 of tr.sse.values()) {
    sseSend(res2, "start", { startAtEpochMs: tr.startAtEpochMs, serverNowMs: nowMs() });
  }

  // pusha start event till WS
  for (const ws of tr.ws.values()) {
    wsSafeSend(ws, { type: "start", startAtEpochMs: tr.startAtEpochMs, serverNowMs: nowMs() });
  }
}

function resetStart(tr) {
  tr.startAtEpochMs = null;
  tr.winnerCid = null; // ✅ NYTT
  for (const p of tr.players.values()) {
	p.ready = false;
    p.finishedAtEpochMs = null; // ✅ NYTT
  }
  // informera (valfritt)
  for (const res2 of tr.sse.values()) {
    sseSend(res2, "start", { startAtEpochMs: null, serverNowMs: nowMs() });
  }
  for (const ws of tr.ws.values()) {
    wsSafeSend(ws, { type: "start", startAtEpochMs: null, serverNowMs: nowMs() });
  }
}

/* =========================
   HTTP routes (som innan)
========================= */
app.get("/health", (req, res) => res.status(200).json({ ok: true }));

// SSE: klienten lyssnar på server events
app.get("/sse", (req, res) => {
  const trackId = String(req.query.track || "track-000");
  const cid = String(req.query.cid || "");
  if (!cid) return res.status(400).json({ ok: false, err: "missing_cid" });

  const tr = getTrack(trackId);
  cleanup(tr);

  // markera som online
  if (!tr.players.has(cid)) {
    tr.players.set(cid, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false, finishedAtEpochMs: null });
  } else {
    tr.players.get(cid).ts = nowMs();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  tr.sse.set(cid, res);

  const opp = opponentOf(tr, cid);
  sseSend(res, "state", {
    ok: true,
    track: trackId,
    startAtEpochMs: tr.startAtEpochMs,
    hasOpponent: !!opp,
    opponent: opp ? { ...opp.p, cid: opp.cid, ageMs: nowMs() - (opp.p.ts || nowMs()) } : null,
    serverNowMs: nowMs()
  });

  // keep-alive ping
  const ping = setInterval(() => {
    try {
      // ✅ håll spelaren "alive" även om den inte tickar (t.ex. i menyn)
      const p = track.players.get(cid);
      if (p) p.ts = nowMs();
      sseSend(res, "ping", { t: nowMs() });
    } catch {}
  }, 15000);

  req.on("close", () => {
    clearInterval(ping);
    const tr2 = getTrack(trackId);
    tr2.sse.delete(cid);
  });
});

// POST tick: klient postar sin position
app.post("/tick", (req, res) => {
  const { track, cid, x, y, vx, vy } = req.body || {};
  if (!track || !cid) return res.status(400).json({ ok: false, err: "missing_track_or_cid" });

  const trackId = String(track);
  const C = String(cid);

  const tr = getTrack(trackId);
  cleanup(tr);

  if (!tr.players.has(C)) {
    tr.players.set(C, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false, finishedAtEpochMs: null });
  }

  const p = tr.players.get(C);
  p.x = Number(x) || 0;
  p.y = Number(y) || 0;
  p.vx = Number(vx) || 0;
  p.vy = Number(vy) || 0;
  p.ts = nowMs();

  // push update till andra via SSE (som innan)
  const opp = opponentOf(tr, C);
  if (opp) {
    const oppRes = tr.sse.get(opp.cid);
    if (oppRes) {
      sseSend(oppRes, "opponent", {
        x: p.x, y: p.y, vx: p.vx, vy: p.vy,
        ageMs: 0,
        ready: !!p.ready,
        cid: C
      });
    }
  }

  return res.json({
    ok: true,
    startAtEpochMs: tr.startAtEpochMs,
    playersCount: tr.players.size
  });
});

// POST ready: markera ready, sätt gemensam start om båda ready
app.post("/ready", (req, res) => {
  const { track, cid, ready } = req.body || {};
  if (!track || !cid) return res.status(400).json({ ok: false, err: "missing_track_or_cid" });

  const trackId = String(track);
  const C = String(cid);

  const tr = getTrack(trackId);
  cleanup(tr);

  if (!tr.players.has(C)) {
    tr.players.set(C, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false, finishedAtEpochMs: null });
  }

  const p = tr.players.get(C);
  p.ready = !!ready;
  p.ts = nowMs();

  // arm/nolla start
  if (tr.players.size >= 2) {
    let allReady = true;
    for (const pl of tr.players.values()) {
      if (!pl.ready) { allReady = false; break; }
    }
    if (allReady) {
      if (!Number.isFinite(tr.startAtEpochMs)) tr.startAtEpochMs = nowMs() + 3500;
    } else {
      tr.startAtEpochMs = null;
    }
  } else {
    tr.startAtEpochMs = null;
  }

  // broadcast startAt till alla SSE-klienter
  for (const res2 of tr.sse.values()) {
    sseSend(res2, "start", { startAtEpochMs: tr.startAtEpochMs, serverNowMs: nowMs() });
  }

  // broadcast startAt till alla WS-klienter
  for (const ws of tr.ws.values()) {
    wsSafeSend(ws, { type: "start", startAtEpochMs: tr.startAtEpochMs, serverNowMs: nowMs() });
  }

  return res.json({
    ok: true,
    startAtEpochMs: tr.startAtEpochMs,
    playersCount: tr.players.size
  });
});

app.post("/finish", (req, res) => {
  // ✅ vi tar emot x,y (och ev vx,vy) så servern kan sätta spelaren på mållinjen direkt
  const { track, cid, x, y, vx, vy } = req.body || {};
  if (!track || !cid) return res.status(400).json({ ok: false, err: "missing_track_or_cid" });

  const trackId = String(track);
  const C = String(cid);

  const tr = getTrack(trackId);
  cleanup(tr);

  // säkerställ player
  if (!tr.players.has(C)) {
    tr.players.set(C, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false, finishedAtEpochMs: null });
  }

  const p = tr.players.get(C);
  p.ts = nowMs();

  // ✅ uppdatera pos om klienten skickar (valfritt men bra)
  if (Number.isFinite(Number(x))) p.x = Number(x);
  if (Number.isFinite(Number(y))) p.y = Number(y);
  if (Number.isFinite(Number(vx))) p.vx = Number(vx);
  if (Number.isFinite(Number(vy))) p.vy = Number(vy);

  // ✅ servern sätter finish-tiden (för fairness)
  if (!Number.isFinite(p.finishedAtEpochMs)) p.finishedAtEpochMs = nowMs();

  // ✅ vinnare = första som finishar
  if (!tr.winnerCid) tr.winnerCid = C;

  // ✅ broadcast (WS)
  for (const ws2 of tr.ws.values()) {
    wsSafeSend(ws2, {
      type: "finish",
      track: trackId,
      cid: C,
      finishedAtEpochMs: p.finishedAtEpochMs,
      winnerCid: tr.winnerCid,
      // skickar även “sista pos” så klienter kan snappa ghost till mållinjen
      x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      serverNowMs: nowMs()
    });
  }

  // ✅ broadcast (SSE) – om du vill ha kvar kompat
  for (const res2 of tr.sse.values()) {
    sseSend(res2, "finish", {
      track: trackId,
      cid: C,
      finishedAtEpochMs: p.finishedAtEpochMs,
      winnerCid: tr.winnerCid,
      x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      serverNowMs: nowMs()
    });
  }

  return res.json({
    ok: true,
    track: trackId,
    cid: C,
    winnerCid: tr.winnerCid,
    finishedAtEpochMs: p.finishedAtEpochMs
  });
});


/* =========================
   WebSocket server (/ws)
========================= */
const httpServer = http.createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

// ping/pong keepalive
function startPingLoop(ws) {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  const iv = setInterval(() => {
    if (ws.readyState !== ws.OPEN) { clearInterval(iv); return; }
    if (!ws.isAlive) {
      try { ws.terminate(); } catch {}
      clearInterval(iv);
      return;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }, 25000);
}

wss.on("connection", (ws) => {
  startPingLoop(ws);

  // bindas efter hello
  let trackId = null;
  let cid = null;

  ws.on("message", (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }
    if (!msg || typeof msg !== "object") return;

    // HELLO: {type:"hello", track, cid}
    if (msg.type === "hello") {
      trackId = String(msg.track || "track-000");
      cid = String(msg.cid || "");
      if (!cid) return;

      const tr = getTrack(trackId);
      cleanup(tr);

      // register ws
      tr.ws.set(cid, ws);
      startWsBroadcastLoop(trackId);

      // register player if not exists
      if (!tr.players.has(cid)) {
        tr.players.set(cid, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false, finishedAtEpochMs: null });
      } else {
        tr.players.get(cid).ts = nowMs();
      }

      wsSafeSend(ws, {
        type: "state",
        ok: true,
        track: trackId,
        serverNowMs: nowMs(),
        startAtEpochMs: tr.startAtEpochMs,
        playersCount: tr.players.size
      });

      return;
    }

    // måste hello först
    if (!trackId || !cid) return;

    const tr = getTrack(trackId);
    cleanup(tr);

    // UPDATE: {type:"update", x,y,vx,vy}
    if (msg.type === "update") {
      if (!tr.players.has(cid)) {
        tr.players.set(cid, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false, finishedAtEpochMs: null });
      }
      const p = tr.players.get(cid);

      const x = Number(msg.x);
      const y = Number(msg.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      p.x = x;
      p.y = y;
      p.vx = Number.isFinite(Number(msg.vx)) ? Number(msg.vx) : 0;
      p.vy = Number.isFinite(Number(msg.vy)) ? Number(msg.vy) : 0;
      p.ts = nowMs();
      return;
    }

    // READY: {type:"ready", ready:true/false}
    if (msg.type === "ready") {
      if (!tr.players.has(cid)) {
        tr.players.set(cid, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false, finishedAtEpochMs: null });
      }
      const p = tr.players.get(cid);
      p.ready = !!msg.ready;
      p.ts = nowMs();

      // om någon blir unready -> resetta start
      if (!p.ready) {
        tr.startAtEpochMs = null;
      }

      // om alla ready -> sätt start
      maybeArmStart(tr);

      wsSafeSend(ws, {
        type: "readyAck",
        serverNowMs: nowMs(),
        startAtEpochMs: tr.startAtEpochMs,
        playersCount: tr.players.size
      });

      return;
    }

	// FINISH-CLAIM: {type:"finishClaim", x, y}
	if (msg.type === "finishClaim") {
	  cleanup(tr);

	  // Skapa spelare om saknas
	  if (!tr.players.has(cid)) {
		tr.players.set(cid, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false, finishedAtEpochMs: null });
	  }

	  const p = tr.players.get(cid);
	  p.ts = nowMs();

	  // redan i mål? ignore (idempotent)
	  if (Number.isFinite(p.finishedAtEpochMs)) return;

	  // verifiera mot serverns mållinje
	  const v = verifyFinishClaim(trackId, msg.x, msg.y);
	  if (!v.ok) {
		// valfritt: debug-a lite men spamma inte
		// wsSafeSend(ws, { type:"finishRejected", reason: v.err || "not_on_finish", d: v.d, thr: v.thr, serverNowMs: nowMs() });
		return;
	  }

	  // ✅ servern sätter tiden (rättvist)
	  p.finishedAtEpochMs = nowMs();

	  // ✅ vinnare = första verifierade finish
	  if (!tr.winnerCid) tr.winnerCid = cid;

	  // broadcast till alla WS
	  for (const ws2 of tr.ws.values()) {
		wsSafeSend(ws2, {
		  type: "finish",
		  cid,
		  finishedAtEpochMs: p.finishedAtEpochMs,
		  winnerCid: tr.winnerCid,
		  serverNowMs: nowMs(),
		});
	  }

	  // (valfritt) till SSE också
	  for (const res2 of tr.sse.values()) {
		sseSend(res2, "finish", {
		  cid,
		  finishedAtEpochMs: p.finishedAtEpochMs,
		  winnerCid: tr.winnerCid,
		  serverNowMs: nowMs(),
		});
	  }

	  return;
	}

    // LEAVE: {type:"leave"}
    if (msg.type === "leave") {
      try { ws.close(); } catch {}
      return;
    }
  });

  ws.on("close", () => {
    if (!trackId || !cid) return;
    const tr = getTrack(trackId);

    tr.ws.delete(cid);

    // val: spelare kan få ligga kvar en stund via TTL, men start ska nollas direkt
    tr.startAtEpochMs = null;
    for (const p of tr.players.values()) p.ready = false;

    // informera kvarvarande
    for (const ws2 of tr.ws.values()) {
      wsSafeSend(ws2, { type: "start", startAtEpochMs: null, serverNowMs: nowMs() });
    }
  });
});

/* =========================
   Start server
========================= */
httpServer.listen(PORT, () => {
  console.log(`runner-mp listening (SSE+REST+WS) on ${PORT}`);
});
