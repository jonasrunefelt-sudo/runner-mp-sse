// server.js
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors()); // OK för test
app.use(express.json({ limit: "64kb" }));

const PORT = process.env.PORT || 3000;

/**
 * In-memory state per track:
 * tracks[trackId] = {
 *   players: Map(cid -> {
 *     x,y,vx,vy, ts, ready,
 *     finishedAtEpochMs: number|null,
 *     finish: { x:number, y:number, runMs:number|null, serverNowMs:number } | null
 *   }),
 *   startAtEpochMs: number|null,
 *   winnerCid: string|null,
 *   sse: Map(cid -> res),
 *   ws:  Map(cid -> ws),
 *   _broadcastTimer: any,
 * }
 */
const tracks = new Map();
const TTL_MS = 60000;

function nowMs() {
  return Date.now();
}

function getTrack(trackId) {
  if (!tracks.has(trackId)) {
    tracks.set(trackId, {
      players: new Map(),
      startAtEpochMs: null,
      winnerCid: null,
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
        try {
          sseRes.end();
        } catch {}
        track.sse.delete(cid);
      }

      const ws = track.ws.get(cid);
      if (ws) {
        try {
          ws.close();
        } catch {}
        track.ws.delete(cid);
      }
    }
  }

  // Om <2 spelare kvar: nolla start/ready/winner + finish state
  if (track.players.size < 2) {
    track.startAtEpochMs = null;
    track.winnerCid = null;
    for (const p of track.players.values()) {
      p.ready = false;
      p.finishedAtEpochMs = null;
      p.finish = null;
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
  try {
    ws.send(JSON.stringify(obj));
  } catch {}
}

function startWsBroadcastLoop(trackId) {
  const tr = getTrack(trackId);
  if (tr._broadcastTimer) return;

  // ✅ Höj snapshot-hz här (detta är din "strypbricka")
  const HZ = Number(process.env.SNAPSHOT_HZ || 30); // 30 Hz default
  const PERIOD = Math.max(10, Math.round(1000 / Math.max(1, HZ))); // clamp (min 10ms)

  tr._broadcastTimer = setInterval(() => {
    cleanup(tr);
    if (tr.ws.size === 0) return;

    const t = nowMs();
    const players = [];
    let readyCount = 0;

    for (const [cid, p] of tr.players.entries()) {
      if (p.ready) readyCount++;

      // ✅ Skicka NULL om position ej initierad istället för 0
      const x = Number.isFinite(p.x) ? p.x : null;
      const y = Number.isFinite(p.y) ? p.y : null;
      const vx = Number.isFinite(p.vx) ? p.vx : 0;
      const vy = Number.isFinite(p.vy) ? p.vy : 0;

      players.push({
        cid,
        x,
        y,
        vx,
        vy,
        ts: p.ts || 0,
        ready: !!p.ready,
        finishedAtEpochMs: p.finishedAtEpochMs ?? null,
        finish: p.finish ?? null,
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

    for (const ws of tr.ws.values()) {
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
    if (!p.ready) {
      allReady = false;
      break;
    }
  }
  if (!allReady) return;

  // marginal: 3.5s
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
  tr.winnerCid = null;
  for (const p of tr.players.values()) {
    p.ready = false;
    p.finishedAtEpochMs = null;
    p.finish = null;
  }

  for (const res2 of tr.sse.values()) {
    sseSend(res2, "start", { startAtEpochMs: null, serverNowMs: nowMs() });
  }
  for (const ws of tr.ws.values()) {
    wsSafeSend(ws, { type: "start", startAtEpochMs: null, serverNowMs: nowMs() });
  }
}

/* =========================
   HTTP routes
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
    tr.players.set(cid, {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ts: nowMs(),
      ready: false,
      finishedAtEpochMs: null,
      finish: null,
    });
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
    winnerCid: tr.winnerCid ?? null,
    hasOpponent: !!opp,
    opponent: opp ? { ...opp.p, cid: opp.cid, ageMs: nowMs() - (opp.p.ts || nowMs()) } : null,
    serverNowMs: nowMs(),
  });

  // keep-alive ping
  const ping = setInterval(() => {
    try {
      const p = tr.players.get(cid);
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

// POST tick (SSE/REST-läge): klient postar sin position
app.post("/tick", (req, res) => {
  const { track, cid, x, y, vx, vy } = req.body || {};
  if (!track || !cid) return res.status(400).json({ ok: false, err: "missing_track_or_cid" });

  const trackId = String(track);
  const C = String(cid);

  const tr = getTrack(trackId);
  cleanup(tr);

  if (!tr.players.has(C)) {
    tr.players.set(C, {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ts: nowMs(),
      ready: false,
      finishedAtEpochMs: null,
      finish: null,
    });
  }

  const p = tr.players.get(C);
  p.x = Number(x) || 0;
  p.y = Number(y) || 0;
  p.vx = Number(vx) || 0;
  p.vy = Number(vy) || 0;
  p.ts = nowMs();

  // push update till andra via SSE
  const opp = opponentOf(tr, C);
  if (opp) {
    const oppRes = tr.sse.get(opp.cid);
    if (oppRes) {
      sseSend(oppRes, "opponent", {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        ageMs: 0,
        ready: !!p.ready,
        cid: C,
      });
    }
  }

  return res.json({
    ok: true,
    startAtEpochMs: tr.startAtEpochMs,
    playersCount: tr.players.size,
  });
});

// POST ready (SSE/REST-läge)
app.post("/ready", (req, res) => {
  const { track, cid, ready } = req.body || {};
  if (!track || !cid) return res.status(400).json({ ok: false, err: "missing_track_or_cid" });

  const trackId = String(track);
  const C = String(cid);

  const tr = getTrack(trackId);
  cleanup(tr);

  if (!tr.players.has(C)) {
    tr.players.set(C, {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ts: nowMs(),
      ready: false,
      finishedAtEpochMs: null,
      finish: null,
    });
  }

  const p = tr.players.get(C);
  p.ready = !!ready;
  p.ts = nowMs();

  // arm/nolla start
  if (tr.players.size >= 2) {
    let allReady = true;
    for (const pl of tr.players.values()) {
      if (!pl.ready) {
        allReady = false;
        break;
      }
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
    playersCount: tr.players.size,
  });
});

// HTTP finish (om du vill ha kvar REST-variant)
// Body: {track,cid,x,y,runMs}
app.post("/finish", (req, res) => {
  const { track, cid, x, y, runMs } = req.body || {};
  if (!track || !cid) return res.status(400).json({ ok: false, err: "missing_track_or_cid" });

  const trackId = String(track);
  const C = String(cid);

  const tr = getTrack(trackId);
  cleanup(tr);

  if (!tr.players.has(C)) {
    tr.players.set(C, {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ts: nowMs(),
      ready: false,
      finishedAtEpochMs: null,
      finish: null,
    });
  }

  const p = tr.players.get(C);
  p.ts = nowMs();

  // ✅ servern tidsstämplar finish (rättvist för "vem vann")
  if (!Number.isFinite(p.finishedAtEpochMs)) p.finishedAtEpochMs = nowMs();

  // ✅ spara finish-payload (för exakt “snap” visuellt)
  const fx = Number(x);
  const fy = Number(y);
  const frun = Number(runMs);
  p.finish = {
    x: Number.isFinite(fx) ? fx : (p.x || 0),
    y: Number.isFinite(fy) ? fy : (p.y || 0),
    runMs: Number.isFinite(frun) ? frun : null,
    serverNowMs: nowMs(),
  };

  // ✅ vinnare = första som finishar
  if (!tr.winnerCid) tr.winnerCid = C;

  const payload = {
	  type: "finish",
	  cid,
	  finishedAtEpochMs: p.finishedAtEpochMs,
	  winnerCid: tr.winnerCid,
	  serverNowMs: nowMs(),
	  finish: { x: p.x, y: p.y },   // ✅ EXAKT position
  };

  for (const ws2 of tr.ws.values()) wsSafeSend(ws2, payload);
  for (const res2 of tr.sse.values()) sseSend(res2, "finish", payload);

  return res.json({ ok: true, winnerCid: tr.winnerCid, finishedAtEpochMs: p.finishedAtEpochMs });
});

/* =========================
   WebSocket server (/ws)
========================= */
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

// ping/pong keepalive
function startPingLoop(ws) {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  const iv = setInterval(() => {
    if (ws.readyState !== ws.OPEN) {
      clearInterval(iv);
      return;
    }
    if (!ws.isAlive) {
      try {
        ws.terminate();
      } catch {}
      clearInterval(iv);
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {}
  }, 25000);
}

wss.on("connection", (ws) => {
  startPingLoop(ws);

  // bindas efter hello
  let trackId = null;
  let cid = null;

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }
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
        tr.players.set(cid, {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          ts: nowMs(),
          ready: false,
          finishedAtEpochMs: null,
          finish: null,
        });
      } else {
        tr.players.get(cid).ts = nowMs();
      }

      wsSafeSend(ws, {
        type: "state",
        ok: true,
        track: trackId,
        serverNowMs: nowMs(),
        startAtEpochMs: tr.startAtEpochMs,
        winnerCid: tr.winnerCid ?? null,
        playersCount: tr.players.size,
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
        tr.players.set(cid, {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          ts: nowMs(),
          ready: false,
          finishedAtEpochMs: null,
          finish: null,
        });
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
        tr.players.set(cid, {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          ts: nowMs(),
          ready: false,
          finishedAtEpochMs: null,
          finish: null,
        });
      }
      const p = tr.players.get(cid);
      p.ready = !!msg.ready;
      p.ts = nowMs();

      // om någon blir unready -> resetta start
      if (!p.ready) {
        tr.startAtEpochMs = null;
        // (valfritt) även nolla winner/finish om du vill kräva ny match:
        tr.winnerCid = null;
        for (const pl of tr.players.values()) {
          pl.finishedAtEpochMs = null;
          pl.finish = null;
        }
      }

      // om alla ready -> sätt start
      maybeArmStart(tr);

      wsSafeSend(ws, {
        type: "readyAck",
        serverNowMs: nowMs(),
        startAtEpochMs: tr.startAtEpochMs,
        playersCount: tr.players.size,
      });

      return;
    }

	// FINISH: {type:"finish", x, y, runMs}
	if (msg.type === "finish") {
	  cleanup(tr);

	  if (!tr.players.has(cid)) {
		tr.players.set(cid, {
		  x: 0,
		  y: 0,
		  vx: 0,
		  vy: 0,
		  ts: nowMs(),
		  ready: false,
		  finishedAtEpochMs: null,
		  finish: null,
		});
	  }

	  const p = tr.players.get(cid);
	  p.ts = nowMs();

	  // ✅ ta emot finish-position från klienten
	  const fx = Number(msg.x);
	  const fy = Number(msg.y);
	  const frun = Number(msg.runMs);

	  // Uppdatera även "senaste position" så snapshot matchar finish
	  if (Number.isFinite(fx)) p.x = fx;
	  if (Number.isFinite(fy)) p.y = fy;

	  // ✅ servern avgör tiden (rättvist för "vem vann")
	  if (!Number.isFinite(p.finishedAtEpochMs)) {
		p.finishedAtEpochMs = nowMs();
	  }

	  // ✅ spara finish-payload för exakt “snap”
	  p.finish = {
		x: Number.isFinite(fx) ? fx : (p.x || 0),
		y: Number.isFinite(fy) ? fy : (p.y || 0),
		runMs: Number.isFinite(frun) ? frun : null,
		serverNowMs: nowMs(),
	  };

	  // ✅ vinnare = första som finishar
	  if (!tr.winnerCid) {
		tr.winnerCid = cid;
	  }

	  const payload = {
		type: "finish",
		cid,
		finishedAtEpochMs: p.finishedAtEpochMs,
		winnerCid: tr.winnerCid,
		serverNowMs: nowMs(),
		finish: p.finish, // ✅ skicka hela objektet (x,y,runMs,serverNowMs)
	  };

	  // broadcast till alla WS
	  for (const ws2 of tr.ws.values()) {
		wsSafeSend(ws2, payload);
	  }

	  // (valfritt) till SSE också
	  for (const res2 of tr.sse.values()) {
		sseSend(res2, "finish", payload);
	  }

	  return;
	}
  });

  ws.on("close", () => {
    if (!trackId || !cid) return;
    const tr = getTrack(trackId);

    tr.ws.delete(cid);

    // val: spelare kan få ligga kvar en stund via TTL,
    // men start ska nollas direkt
    tr.startAtEpochMs = null;
    tr.winnerCid = null;
    for (const p of tr.players.values()) {
      p.ready = false;
      p.finishedAtEpochMs = null;
      p.finish = null;
    }

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
