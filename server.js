// server.js (WS-only)
// Node + Express + ws
//
// Env vars:
// - PORT (default 3000)
// - TTL_MS (default 60000)
// - SNAPSHOT_HZ (default 30)
// - START_DELAY_MS (default 3500)

import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

const PORT = Number(process.env.PORT || 3000);
const TTL_MS = Number(process.env.TTL_MS || 60000);
const SNAPSHOT_HZ = Number(process.env.SNAPSHOT_HZ || 60);
const START_DELAY_MS = Number(process.env.START_DELAY_MS || 3500);

function nowMs() {
  return Date.now();
}

/**
 * tracks[trackId] = {
 *   players: Map(cid -> {
 *     x,y,vx,vy, ts, ready,
 *     finishedAtEpochMs: number|null,
 *     finish: { x:number, y:number, runMs:number|null, serverNowMs:number } | null
 *   }),
 *   startAtEpochMs: number|null,
 *   winnerCid: string|null,
 *   ws: Map(cid -> ws),
 *   _broadcastTimer: any,
 * }
 */
const tracks = new Map();

function getTrack(trackId) {
  if (!tracks.has(trackId)) {
    tracks.set(trackId, {
      players: new Map(),
      startAtEpochMs: null,
      winnerCid: null,
      ws: new Map(),
      _broadcastTimer: null,
    });
  }
  return tracks.get(trackId);
}

function wsSafeSend(ws, obj) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch {}
}

function broadcast(tr, obj) {
  for (const ws of tr.ws.values()) wsSafeSend(ws, obj);
}

function cleanup(tr) {
  const t = nowMs();

  for (const [cid, p] of tr.players.entries()) {
    if (t - (p.ts || 0) > TTL_MS) {
      tr.players.delete(cid);

      const ws = tr.ws.get(cid);
      if (ws) {
        try {
          ws.close();
        } catch {}
        tr.ws.delete(cid);
      }
    }
  }

  // Om <2 spelare: nolla matchstate och kräva ny ready
  if (tr.players.size < 2) {
    resetMatch(tr, { broadcastStartNull: true });
  }
}

function resetMatch(tr, { broadcastStartNull } = { broadcastStartNull: false }) {
  tr.startAtEpochMs = null;
  tr.winnerCid = null;

  for (const p of tr.players.values()) {
    p.ready = false;
    p.finishedAtEpochMs = null;
    p.finish = null;
  }

  if (broadcastStartNull) {
    broadcast(tr, { type: "start", startAtEpochMs: null, serverNowMs: nowMs() });
  }
}

function maybeArmStart(tr) {
  if (Number.isFinite(tr.startAtEpochMs)) return; // already armed
  if (tr.players.size < 2) return;

  // kräver att alla är ready
  for (const p of tr.players.values()) {
    if (!p.ready) return;
  }

  tr.startAtEpochMs = nowMs() + START_DELAY_MS;

  // pusha start event via WS
  broadcast(tr, { type: "start", startAtEpochMs: tr.startAtEpochMs, serverNowMs: nowMs() });
}

function startWsBroadcastLoop(trackId) {
  const tr = getTrack(trackId);
  if (tr._broadcastTimer) return;

  const hz = Number.isFinite(SNAPSHOT_HZ) && SNAPSHOT_HZ > 0 ? SNAPSHOT_HZ : 30;
  const period = Math.max(10, Math.round(1000 / hz));

  tr._broadcastTimer = setInterval(() => {
    cleanup(tr);
    if (tr.ws.size === 0) return;

    const t = nowMs();
    const players = [];
    let readyCount = 0;

    for (const [cid, p] of tr.players.entries()) {
      if (p.ready) readyCount++;

      // ✅ Skicka null om position ej initierad (inte 0,0)
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

    broadcast(tr, pkt);
  }, period);
}

/* =========================
   GLOBAL: Track presence (WS-only, push)
   - No HTTP endpoints
   - Sent to ALL connected WS clients (also those not hello-bound)
========================= */

// All connected sockets (even before hello)
const allWs = new Set();

let presenceTimer = null;
const PRESENCE_HZ = 1; // 1 Hz is enough for UI
const PRESENCE_PERIOD_MS = Math.max(250, Math.round(1000 / PRESENCE_HZ));

function sendGlobalTrackPresence() {
  const t = nowMs();
  const out = {};

  for (const [trackId, tr] of tracks.entries()) {
    // Do a light cleanup for accurate counts
    cleanup(tr);

    // Count "active" players as those with recent ts
    let active = 0;
    for (const p of tr.players.values()) {
      if (t - (p.ts || 0) <= TTL_MS) active++;
    }

    if (active <= 0) continue;

    // Simple phase split:
    // - lobby: no start armed OR countdown not started yet
    // - race: start time reached (includes ongoing race/finish waiting)
    let lobby = 0;
    let race = 0;

    if (!Number.isFinite(tr.startAtEpochMs)) {
      lobby = active;
      race = 0;
    } else if (t < tr.startAtEpochMs) {
      // countdown phase (treat as lobby; you can show as "COUNTDOWN" client-side if you want)
      lobby = active;
      race = 0;
    } else {
      lobby = 0;
      race = active;
    }

    out[String(trackId)] = { lobby, race };
  }

  const pkt = { type: "track_presence", serverNowMs: t, tracks: out };

  for (const ws of allWs) wsSafeSend(ws, pkt);
}

function startGlobalPresenceLoop() {
  if (presenceTimer) return;
  presenceTimer = setInterval(sendGlobalTrackPresence, PRESENCE_PERIOD_MS);
}

/* =========================
   HTTP routes (minimal)
========================= */
app.get("/health", (req, res) => res.status(200).json({ ok: true }));

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

  // ✅ global registry (so ONLINE track list can receive presence without hello)
  allWs.add(ws);
  startGlobalPresenceLoop();

  // binds after hello
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

    // PING: allow before hello (health-only) + treat as heartbeat after hello
    if (msg.type === "ping") {
      // If we're already bound to a track+cid (hello done), refresh ts
      if (trackId && cid) {
        const tr = getTrack(trackId);
        const p = tr.players.get(cid);
        if (p) p.ts = nowMs();
      }

      wsSafeSend(ws, { type: "pong", serverNowMs: nowMs() });
      return;
    }

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
          x: null,
          y: null,
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

      // state ack
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

    // must hello first
    if (!trackId || !cid) return;

    const tr = getTrack(trackId);
    cleanup(tr);

    // UPDATE: {type:"update", x,y,vx,vy}
    if (msg.type === "update") {
      if (!tr.players.has(cid)) {
        tr.players.set(cid, {
          x: null,
          y: null,
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
          x: null,
          y: null,
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

      // om någon blir unready -> resetta match direkt (ny ready krävs)
      if (!p.ready) {
        resetMatch(tr, { broadcastStartNull: true });
      } else {
        // om alla ready -> arm start
        maybeArmStart(tr);
      }

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
      if (!tr.players.has(cid)) {
        tr.players.set(cid, {
          x: null,
          y: null,
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

      const fx = Number(msg.x);
      const fy = Number(msg.y);
      const frun = Number(msg.runMs);

      // Uppdatera även "senaste position" så snapshot matchar finish
      if (Number.isFinite(fx)) p.x = fx;
      if (Number.isFinite(fy)) p.y = fy;

      // Servern tidsstämplar finish rättvist
      if (!Number.isFinite(p.finishedAtEpochMs)) p.finishedAtEpochMs = nowMs();

      // Spara finish-payload för exakt “snap”
      p.finish = {
        x: Number.isFinite(fx) ? fx : (Number.isFinite(p.x) ? p.x : 0),
        y: Number.isFinite(fy) ? fy : (Number.isFinite(p.y) ? p.y : 0),
        runMs: Number.isFinite(frun) ? frun : null,
        serverNowMs: nowMs(),
      };

      // vinnare = första som finishar
      if (!tr.winnerCid) tr.winnerCid = cid;

      const payload = {
        type: "finish",
        cid,
        finishedAtEpochMs: p.finishedAtEpochMs,
        winnerCid: tr.winnerCid,
        serverNowMs: nowMs(),
        finish: p.finish,
      };

      broadcast(tr, payload);
      return;
    }

    // (valfritt) PING: {type:"ping"} -> time sync + heartbeat
    if (msg.type === "ping") {
      const p = tr.players.get(cid);
      if (p) p.ts = nowMs();
      wsSafeSend(ws, { type: "pong", serverNowMs: nowMs() });
      return;
    }
  });

  ws.on("close", () => {
    // ✅ remove from global
    allWs.delete(ws);

    if (!trackId || !cid) return;

    const tr = getTrack(trackId);

    tr.ws.delete(cid);

    // match reset direkt när någon lämnar
    resetMatch(tr, { broadcastStartNull: true });

    // spelare får ligga kvar i players-map tills TTL tar bort dem,
    // men du kan också ta bort direkt om du vill:
    // tr.players.delete(cid);
  });
});

/* =========================
   Start server
========================= */
httpServer.listen(PORT, () => {
  console.log(`runner-mp listening (WS-only) on ${PORT} | snapshot_hz=${SNAPSHOT_HZ}`);
});
