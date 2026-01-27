import express from "express";
import cors from "cors";

const app = express();
app.use(cors());                 // OK för test. Sen kan vi låsa till din domän.
app.use(express.json({ limit: "64kb" }));

// Koyeb sätter PORT. Lokalt faller vi tillbaka.
const PORT = process.env.PORT || 3000;

/**
 * In-memory state per track:
 * tracks[trackId] = {
 *   players: Map(cid -> { x,y,vx,vy, ts, ready }),
 *   startAtEpochMs: number|null,
 *   sse: Map(cid -> res),
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
      sse: new Map(),
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
    }
  }
  // Om <2 spelare kvar: nolla start
  if (track.players.size < 2) {
    track.startAtEpochMs = null;
    for (const p of track.players.values()) p.ready = false;
  }
}

function opponentOf(track, cid) {
  for (const [k, v] of track.players.entries()) {
    if (k !== cid) return { cid: k, p: v };
  }
  return null;
}

function sseSend(res, event, dataObj) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
}

app.get("/health", (req, res) => res.status(200).json({ ok: true }));

// SSE: klienten lyssnar på server events
app.get("/sse", (req, res) => {
  const trackId = String(req.query.track || "track-000");
  const cid = String(req.query.cid || "");

  if (!cid) return res.status(400).json({ ok: false, err: "missing_cid" });

  const track = getTrack(trackId);
  cleanup(track);

  // markera som "online"
  if (!track.players.has(cid)) {
    track.players.set(cid, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false });
  } else {
    const p = track.players.get(cid);
    p.ts = nowMs();
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Spara res så vi kan push:a events
  track.sse.set(cid, res);

  // Skicka initial state
  const opp = opponentOf(track, cid);
  sseSend(res, "state", {
    ok: true,
    track: trackId,
    startAtEpochMs: track.startAtEpochMs,
    hasOpponent: !!opp,
    opponent: opp ? { ...opp.p, cid: opp.cid, ageMs: nowMs() - (opp.p.ts || nowMs()) } : null,
    serverNowMs: nowMs()
  });

  // keep-alive ping (viktigt för proxies)
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
    // Stäng koppling
    const tr = getTrack(trackId);
    tr.sse.delete(cid);
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
    tr.players.set(C, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false });
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
    tr.players.set(C, { x: 0, y: 0, vx: 0, vy: 0, ts: nowMs(), ready: false });
  }
  const p = tr.players.get(C);
  p.ready = !!ready;
  p.ts = nowMs();

  // är vi två och båda ready?
  if (tr.players.size >= 2) {
    let allReady = true;
    for (const pl of tr.players.values()) {
      if (!pl.ready) { allReady = false; break; }
    }
    if (allReady) {
      if (!Number.isFinite(tr.startAtEpochMs)) {
        // ✅ ge marginal för gles polling + nät: 3.5s fram
        tr.startAtEpochMs = nowMs() + 3500;
      }
    } else {
      tr.startAtEpochMs = null;
    }
  } else {
    tr.startAtEpochMs = null;
  }

  // broadcast startAt till alla SSE-klienter
  for (const [cid2, res2] of tr.sse.entries()) {
    sseSend(res2, "start", { startAtEpochMs: tr.startAtEpochMs, serverNowMs: nowMs() });
  }

  return res.json({
    ok: true,
    startAtEpochMs: tr.startAtEpochMs,
    playersCount: tr.players.size
  });
});

app.listen(PORT, () => {
  console.log(`runner-mp-sse listening on ${PORT}`);
});
