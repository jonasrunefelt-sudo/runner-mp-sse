// tracks.js
// Endast DATA – ingen logik

/*
// =========================
// OBSTACLE – komplett “mall” (Runner v0.1 + spawn/despawn/intervalTrigger-patch)
// Klistra in i tracks.js under en bana: track.obstacles = [ ... ]
//
// ✅ All tid är i runMs (loppets klocka) i millisekunder.
// ✅ Alla positioner är WORLD-koordinater (samma som din HUD visar: WORLD x/y).
// ✅ spawn/despawn styr om obstacle “finns” (existerar) överhuvudtaget.
// ✅ interval styr ON/OFF-cykel + telegraph.
// ✅ intervalTrigger gör att intervallets “lokala tid” börjar vid en skeppsposition.
// =========================

const OBSTACLE_TEMPLATE = {
  // ----- Grundform / placering -----
  type: "kill",     // "kill" | "heat" | "bounce" | "ramp"
  x: 400,           // WORLD-x (centrum)
  y: 5200,          // WORLD-y (centrum)
  r: 18,            // radie i WORLD (collision + render)

  // (valfritt) typ-specifika parametrar
  restitution: 1.2, // bounce: restitution (default i game.js är 0.92 om saknas)
  strength: 1.0,    // ramp: styrka (default 1.0). Påverkar airborne-höjd/duration.

  // ----- EXISTENS (spawn / despawn) -----
  // Om "spawn" saknas => obstacle finns direkt från start.
  // Om "despawn" saknas => obstacle försvinner aldrig (om inte interval endMs stoppar render/collision).
  //
  // spawn/despawn kan vara tid eller zon.
  // Zon kan triggas på edge: "enter" (default), "inside", "exit".

  // spawn: { timeMs: 6000 }, // spawnar efter 6s run-tid och ligger kvar
  spawn: {
    // Välj EN av nedanstående:
    // timeMs: 6000,

    zone: { x1: 200, y1: 4800, x2: 700, y2: 5600 }, // rektangel i WORLD
    edge: "enter", // "enter" | "inside" | "exit"
    // enter  = triggar när skeppet går in (en gång, latch-as-internal)
    // inside = obstacle finns bara medan skeppet är inne i zonen (”gated existence”)
    // exit   = triggar när skeppet lämnar zonen (en gång)
  },

  // despawn: { timeMs: 15000 }, // försvinner efter 15s run-tid (borta för alltid)
  despawn: {
    // Välj EN av nedanstående:
    // timeMs: 15000,

    // zone: { x1: 100, y1: 3000, x2: 700, y2: 3600 },
    // edge: "enter",
    // OBS: despawn är "latched": när den triggar => borta för alltid.
  },

  // ----- INTERVALL (ON/OFF + telegraph) -----
  // Om "interval" saknas => obstacle är alltid ACTIVE (när den existerar).
  // Om "interval" finns => obstaclePhase() bestämmer:
  //   0 hidden (ej synlig)
  //   1 telegraph (ghost, ingen collision)
  //   2 active (synlig + collision)
  //   3 done (slut; render + collision stoppar)
  interval: {
    startMs: 11000,     // (valfri) börja köra interval efter 11s (default 0)
    endMs:  20000,      // (valfri) sluta efter 20s => phase=3 (”försvinner” visuellt + ingen collision)
    periodMs: 2000,     // krävs (hela cykeln) > 0
    onMs: 600,          // krävs (hur länge i varje cykel som den är ACTIVE)
    telegraphMs: 250,   // (valfri) ghost före ON. I din kod: ghost i slutet av cykeln (p-tele..p)
    offsetMs: 0         // (valfri) fasförskjutning (kan vara negativ)
  },

  // ----- intervalTrigger (starta interval vid skeppsposition) -----
  // Om intervalTrigger finns OCH interval finns:
  //   - obstacle är helt hidden innan triggern hänt (i patchen)
  //   - efter trigger: obstaclePhase körs på (runMs - triggerRunMs)
  // Då blir interval.startMs/endMs RELATIVA trigger-ögonblicket.
  intervalTrigger: {
    zone: { x1: 260, y1: 4900, x2: 680, y2: 5450 },
    edge: "enter" // "enter" | "inside" | "exit"
  },

  // ----- Kvarvarande “legacy” fält i din game.js (om du vill använda dem) -----
  // Dessa används bara om interval INTE finns (oneshot-läge i obstacleTimes):
  //
  // spawnMs: 0,           // oneshot: blir ACTIVE från spawnMs till despawnMs
  // despawnMs: 5000,      // oneshot: slutar efter despawnMs
  // telegraphMs: 300,     // oneshot: ghost mellan (spawnMs-telegraphMs .. spawnMs)
};

// =========================
// Exempel: sätt i en bana:
// =========================
//
// export const TRACKS = [
//   {
//     id: "track-001",
//     name: "...",
//     worldW: 800,
//     worldH: 10000,
//     trackW: 220,
//     segments: [...],
//     obstacles: [
//       { ...OBSTACLE_TEMPLATE, type:"heat", x:420, y:5100, r:14 },
//       // fler...
//     ]
//   }
// ];
*/
export const TRACKS = [
  {
    id: "track-000",
    name: "Speed test",
    worldW: 800,
    worldH: 10000,
    trackW: 220,
    speedTest: true,

    speed: {
      base: 1000,
      boost: 0,
      min: 0,
      maxForward: 1000,
      maxReverse: 0,
      allowReverse: false,
      allowStop: false,
      accelUp: 15,
      accelDown: 8
    },

    medals: {
      gold: 7.8,
      silver: 8.0,
      bronze: 8.5
    },

      segments: [
        "straight 5000",
      ],

      obstacles: [
        // Exempel (ändra/ta bort):
      ],
  },
({
  id: "track-0011",
  name: "Practice track 1",
  worldW: 800,
  trackW: 220,
  speed: {
    base: 0,
    boost: 350,
    min: 0,
    maxForward: 350,
    maxReverse: 0,
    accelUp: 5,
    accelDown: 5,
    allowReverse: false,
    allowStop: false
  },
  medals: {
    gold: 9,
    silver: 11,
    bronze: 12
  },
  segments: [
    {
      type: "line",
      len: 1000
    },
    {
      type: "right",
      r: 120,
      deg: 71
    },
    {
      type: "left",
      r: 220,
      deg: 111
    },
    {
      type: "right",
      r: 220,
      deg: 50
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "line",
      len: 600
    }
  ],
  obstacles: []
}),
({
  id: "track-0012",
  name: "Practice track 2",
  worldW: 800,
  trackW: 220,
  speed: {
    base: 0,
    boost: 500,
    min: 0,
    maxForward: 500,
    maxReverse: 0,
    accelUp: 5,
    accelDown: 5,
    allowReverse: false,
    allowStop: false
  },
  medals: {
    gold: 8,
    silver: 10,
    bronze: 11
  },
  segments: [
    {
      type: "line",
      len: 1000
    },
    {
      type: "right",
      r: 120,
      deg: 71
    },
    {
      type: "left",
      r: 220,
      deg: 122
    },
    {
      type: "right",
      r: 220,
      deg: 64
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "left",
      r: 173,
      deg: 131
    },
    {
      type: "line",
      len: 600
    }
  ],
  obstacles: []
}),
({
  id: "track-0013",
  name: "Practice track 3",
  worldW: 800,
  trackW: 200,
  speed: {
    base: 0,
    boost: 700,
    min: 0,
    maxForward: 700,
    maxReverse: 0,
    accelUp: 7,
    accelDown: 7,
    allowReverse: false,
    allowStop: false
  },
  medals: {
    gold: 8,
    silver: 10,
    bronze: 11
  },
  segments: [
    {
      type: "line",
      len: 1000
    },
    {
      type: "right",
      r: 120,
      deg: 71
    },
    {
      type: "left",
      r: 220,
      deg: 122
    },
    {
      type: "right",
      r: 220,
      deg: 64
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "left",
      r: 173,
      deg: 131
    },
    {
      type: "line",
      len: 600
    }
  ],
  obstacles: []
}),
({
  id: "track-0014",
  name: "Practice track 4",
  worldW: 800,
  trackW: 200,
  speed: {
    base: 200,
    boost: 300,
    min: 0,
    maxForward: 500,
    maxReverse: 0,
    accelUp: 7,
    accelDown: 1,
    allowReverse: false,
    allowStop: false
  },
  medals: {
    gold: 5,
    silver: 8,
    bronze: 9
  },
  segments: [
    {
      type: "line",
      len: 500
    },
    {
      type: "left",
      r: 151,
      deg: 90
    },
    {
      type: "right",
      r: 118,
      deg: 90
    },
    {
      type: "right",
      r: 183,
      deg: 90
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 180,
      deg: 90
    },
    {
      type: "line",
      len: 600
    }
  ],
  obstacles: [
    {
      type: "kill",
      x: 468,
      y: 8616.94915254237,
      r: 18,
      restitution: 0,
      strength: 0
    },
    {
      type: "kill",
      x: 245,
      y: 8317,
      r: 18,
      restitution: 0,
      strength: 0
    }
  ]
}),
{
    id: "track-002",
    name: "Jumper",
    worldW: 800,
    worldH: 10000,
    trackW: 220,

    speed: {
      base: 260,
      boost: 380,
      min: 140,
      maxForward: 640,
      maxReverse: 260,
      allowReverse: false,
      allowStop: false,
      accelUp: 8,
      accelDown: 8
    },

    medals: {
      gold: 7.7,
      silver: 8.0,
      bronze: 8.5
    },

      segments: [
        "straight 700",
        { type: "right", r: 200, deg: 90 },
        "straight 100",
        { type: "left", r: 100, deg: 90 },
        { type: "left", r: 100, deg: 90 },
        "straight 100",
        { type: "right", r: 200, deg: 90 },
        "straight 100",
        { type: "left",  r: 400, deg: 45 },
        "straight 100",
        { type: "right", r: 200, deg: 45 },
        "straight 400",
        { type: "right",  r: 180, deg: 45 },
        "straight 100",
        { type: "left",  r: 180, deg: 45 },
        "straight 100",
        { type: "right",  r: 180, deg: 45 },
        "straight 100",
        { type: "left",  r: 180, deg: 45 },
        "straight 100",
        { type: "left",  r: 180, deg: 45 },
        "straight 100",
        { type: "right",  r: 180, deg: 45 },
        "straight 100",
        { type: "left",  r: 180, deg: 45 },
        { type: "right",  r: 180, deg: 45 },
        { type: "right",  r: 220, deg: 90 },
        { type: "left",   r: 220, deg: 90 },
        "straight 300",
      ],

      obstacles: [
        // Exempel (ändra/ta bort):
        { type: "ramp", x: 400, y: 9000, r: 22, strength: 0.5 },
        { type: "ramp", x: 400, y: 8600, r: 22, strength: 0.5 },
        { type: "kill", x: 320, y: 8400, r: 18 },
        { type: "kill", x: 350, y: 8400, r: 18 },
        { type: "kill", x: 380, y: 8400, r: 18 },
        { type: "kill", x: 410, y: 8400, r: 18 },
        { type: "kill", x: 440, y: 8400, r: 18 },
        { type: "kill", x: 470, y: 8400, r: 18 },
        { type: "bounce", x: 300, y: 7000, r: 27, restitution: 2 },
      ],
  },
  {
    id: "track-003",
    name: "Race line",
    worldW: 800,
    worldH: 10000,
    trackW: 200,

    speed: {
      base: 280,
      boost: 700,
      min: 120,
      maxForward: 980,
      accelUp: 8,
      accelDown: 8
    },

    medals: {
      gold: 9.3,
      silver: 10,
      bronze: 10.5
    },

      segments: [
        { type: "line", len: 1000 },
        { type: "arc", r: 100, a: -Math.PI * 0.7 },
        { type: "line", len: 50 },
        { type: "arc", r: 100, a: +Math.PI * 0.7 },
        { type: "line", len: 50 },
        { type: "arc", r: 100, a: +Math.PI * 0.3 },
        { type: "line", len: 100 },
        { type: "arc", r: 100, a: -Math.PI * 0.4 },
        { type: "line", len: 50 },
        { type: "arc", r: 100, a: +Math.PI * 0.4 },
        { type: "line", len: 650 },
        { type: "arc", r: 100, a: -Math.PI * 0.7 },
        { type: "line", len: 400 },
        { type: "arc", r: 100, a: +Math.PI * 0.7 },
        { type: "line", len: 400 },
        { type: "arc", r: 100, a: -Math.PI * 0.7 },
        { type: "line", len: 400 },
        { type: "arc", r: 100, a: +Math.PI * 0.7 },
        { type: "line", len: 400 },
        { type: "arc", r: 100, a: -Math.PI * 0.7 },
        { type: "line", len: 1000 },
        { type: "arc", r: 100, a: +Math.PI * 0.7 },
        { type: "line", len: 600 },
        { type: "arc", r: 200, a: -Math.PI * 0.3 },
        { type: "line", len: 400 },
        { type: "arc", r: 200, a: +Math.PI * 0.3 },
        { type: "line", len: 1000 },
      ],

      obstacles: [],
  },
  {
    id: "track-004",
    name: "Reverse",
    worldW: 800,
    worldH: 10000,
    trackW: 200,

    speed: {
      base: 280,
      boost: 420,
      min: -200,
      maxForward: 700,
      accelUp: 8,
      accelDown: 8
    },

    medals: {
      gold: 10.7,
      silver: 11.4,
      bronze: 12
    },

      segments: [
        "straight 900",
        { type: "left",  r: 220, deg: 80 },
        { type: "right", r: 100, deg: 80 },
        { type: "right", r: 220, deg: 60 },
        { type: "left",  r: 220, deg: 60 },
        { type: "left",  r: 100, deg: 90 },
        "straight 200",
        { type: "right", r: 100, deg: 90 },
        "straight 800",
        { type: "right", r: 220, deg: 80 },
        { type: "left",  r: 220, deg: 80 },
        { type: "left",  r: 100, deg: 90 },
        { type: "right", r: 100, deg: 90 },
        "straight 800",
        { type: "right", r: 150, deg: 180 },
        "straight 200",
        { type: "left",  r: 150, deg: 180 },
        "straight 800",
      ],

      obstacles: [],
  },
  {
    id: "track-005",
    name: "Reverse 2",
    worldW: 800,
    worldH: 10000,
    trackW: 150,

    speed: {
      base: 280,
      boost: 420,
      min: -200,
      maxForward: 700,
      accelUp: 8,
      accelDown: 8
    },

    medals: {
      gold: 11.6,
      silver: 12.2,
      bronze: 13
    },

      segments: [
        "straight 900",
        { type: "left",  r: 220, deg: 80 },
        { type: "right", r: 100, deg: 80 },
        { type: "right", r: 220, deg: 60 },
        { type: "left",  r: 220, deg: 60 },
        { type: "left",  r: 100, deg: 90 },
        "straight 200",
        { type: "right", r: 100, deg: 90 },
        "straight 800",
        { type: "right", r: 220, deg: 80 },
        { type: "left",  r: 220, deg: 80 },
        { type: "left",  r: 100, deg: 90 },
        { type: "right", r: 100, deg: 90 },
        "straight 800",
        { type: "right", r: 150, deg: 180 },
        "straight 200",
        { type: "left",  r: 150, deg: 180 },
        "straight 800",
      ],

      obstacles: [],
  },
  {
    id: "track-006",
    name: "High speed",
    worldW: 800,
    worldH: 25000,
    trackW: 250,

    speed: {
      base: 0,
      boost: 2000,
      min: 0,
      maxForward: 2000,
      accelUp: 0.5,
      accelDown: 12
    },

    medals: {
      gold: 13.3,
      silver: 14,
      bronze: 15
    },
      segments: [
        "straight 5000",
        { type: "right", r: 200, deg: 25 },
        "straight 500",
        { type: "left", r: 200, deg: 25 },
        "straight 5000",
        { type: "left", r: 200, deg: 25 },
        "straight 500",
        { type: "right", r: 200, deg: 25 },
        "straight 10000",
      ],

      obstacles: [
        { type: "kill", x: 330, y: 24000, r: 18, spawnMs: 1000, despawnMs: 5200, telegraphMs: 1000 },
        { type: "kill", x: 400, y: 24000, r: 18, spawnMs: 1000, despawnMs: 5200, telegraphMs: 1000 },
        { type: "kill", x: 470, y: 24000, r: 18, spawnMs: 1000, despawnMs: 5200, telegraphMs: 1000 },
        { type: "heat", x: 275, y: 24000, r: 10 }, 
        { type: "heat", x: 525, y: 24000, r: 10 }, 
        { type: "heat", x: 275, y: 23500, r: 10 }, 
        { type: "heat", x: 525, y: 23500, r: 10 }, 
        { type: "heat", x: 275, y: 23000, r: 10 }, 
        { type: "heat", x: 525, y: 23000, r: 10 }, 
        { type: "heat", x: 275, y: 22500, r: 10 }, 
        { type: "heat", x: 525, y: 22500, r: 10 }, 
        { type: "kill", x: 330, y: 22000, r: 18, spawnMs: 2700, despawnMs: 5200, telegraphMs: 1000 },
        { type: "kill", x: 400, y: 22000, r: 18, spawnMs: 2700, despawnMs: 5200, telegraphMs: 1000 },
        { type: "kill", x: 470, y: 22000, r: 18, spawnMs: 2700, despawnMs: 5200, telegraphMs: 1000 },
        { type: "heat", x: 275, y: 22000, r: 10 }, 
        { type: "heat", x: 525, y: 22000, r: 10 }, 
        { type: "heat", x: 275, y: 21500, r: 10 }, 
        { type: "heat", x: 525, y: 21500, r: 10 }, 
        { type: "heat", x: 275, y: 21000, r: 10 }, 
        { type: "heat", x: 525, y: 21000, r: 10 }, 
        { type: "heat", x: 275, y: 20500, r: 10 }, 
        { type: "heat", x: 525, y: 20500, r: 10 }, 
        { type: "kill", x: 330, y: 20000, r: 18, spawnMs: 4000, despawnMs: 5200, telegraphMs: 1000 },
        { type: "kill", x: 400, y: 20000, r: 18, spawnMs: 4000, despawnMs: 5200, telegraphMs: 1000 },
        { type: "kill", x: 470, y: 20000, r: 18, spawnMs: 4000, despawnMs: 5200, telegraphMs: 1000 },
        { type: "heat", x: 275, y: 20000, r: 10 }, 
        { type: "heat", x: 525, y: 20000, r: 10 }, 
        { type: "heat", x: 525, y: 19000, r: 10 }, 
        { type: "heat", x: 775, y: 19000, r: 10 }, 
        { type: "heat", x: 525, y: 18500, r: 10 }, 
        { type: "heat", x: 775, y: 18500, r: 10 }, 
        { type: "heat", x: 525, y: 18000, r: 10 }, 
        { type: "heat", x: 775, y: 18000, r: 10 }, 
        { type: "heat", x: 525, y: 17500, r: 10 }, 
        { type: "heat", x: 775, y: 17500, r: 10 }, 
        { type: "heat", x: 525, y: 17000, r: 10 }, 
        { type: "heat", x: 775, y: 17000, r: 10 }, 
        { type: "heat", x: 525, y: 16500, r: 10 }, 
        { type: "heat", x: 775, y: 16500, r: 10 }, 
        { type: "heat", x: 525, y: 16000, r: 10 }, 
        { type: "heat", x: 775, y: 16000, r: 10 }, 
        { type: "heat", x: 525, y: 15500, r: 10 }, 
        { type: "heat", x: 775, y: 15500, r: 10 }, 
        { type: "heat", x: 525, y: 15000, r: 10 }, 
        { type: "heat", x: 775, y: 15000, r: 10 }, 
        { type: "heat", x: 525, y: 14500, r: 10 }, 
        { type: "heat", x: 775, y: 14500, r: 10 }, 
        { type: "heat", x: 275, y: 13500, r: 10 }, 
        { type: "heat", x: 525, y: 13500, r: 10 }, 
        { type: "heat", x: 275, y: 13000, r: 10 }, 
        { type: "heat", x: 525, y: 13000, r: 10 }, 
        { type: "heat", x: 275, y: 12500, r: 10 }, 
        { type: "heat", x: 525, y: 12500, r: 10 }, 
        { type: "heat", x: 275, y: 12000, r: 10 }, 
        { type: "heat", x: 525, y: 12000, r: 10 }, 
        { type: "heat", x: 275, y: 11500, r: 10 }, 
        { type: "heat", x: 525, y: 11500, r: 10 }, 
        { type: "heat", x: 275, y: 11000, r: 10 }, 
        { type: "heat", x: 525, y: 11000, r: 10 }, 
        { type: "heat", x: 275, y: 10500, r: 10 }, 
        { type: "heat", x: 525, y: 10500, r: 10 }, 
        { type: "heat", x: 275, y: 10000, r: 10 }, 
        { type: "heat", x: 525, y: 10000, r: 10 }, 
        { type: "heat", x: 275, y: 9500, r: 10 }, 
        { type: "heat", x: 525, y: 9500, r: 10 }, 
        { type: "heat", x: 275, y: 9000, r: 10 }, 
        { type: "heat", x: 525, y: 9000, r: 10 }, 
        { type: "heat", x: 275, y: 8500, r: 10 }, 
        { type: "heat", x: 525, y: 8500, r: 10 }, 
        { type: "heat", x: 275, y: 8000, r: 10 }, 
        { type: "heat", x: 525, y: 8000, r: 10 }, 
        { type: "heat", x: 275, y: 7500, r: 10 }, 
        { type: "heat", x: 525, y: 7500, r: 10 }, 
        { type: "heat", x: 275, y: 7000, r: 10 }, 
        { type: "heat", x: 525, y: 7000, r: 10 }, 
        { type: "heat", x: 275, y: 6500, r: 10 }, 
        { type: "heat", x: 525, y: 6500, r: 10 }, 
        { type: "heat", x: 275, y: 6000, r: 10 }, 
        { type: "heat", x: 525, y: 6000, r: 10 }, 
        { type: "heat", x: 275, y: 5500, r: 10 }, 
        { type: "heat", x: 525, y: 5500, r: 10 }, 
        { type: "heat", x: 275, y: 5000, r: 10 }, 
        { type: "heat", x: 525, y: 5000, r: 10 }, 
        { type: "heat", x: 275, y: 4500, r: 10 }, 
        { type: "heat", x: 525, y: 4500, r: 10 }, 
        { type: "heat", x: 275, y: 4000, r: 10 }, 
        { type: "heat", x: 525, y: 4000, r: 10 }, 
    ],
  },
  {
    id: "track-007",
    name: "Jumper 2",
    worldW: 800,
    worldH: 10000,
    trackW: 160,

    speed: {
      base: 150,
      boost: 400,
      min: -200,
      maxForward: 550,
      accelUp: 8,
      accelDown: 8
    },

    medals: {
      gold: 11.9,
      silver: 12.5,
      bronze: 13
    },

      segments: [
        "straight 500",
        { type: "right", r: 100, deg: 90 },
        "straight 50",
        { type: "left",  r: 100, deg: 90 },
        { type: "left",  r: 100, deg: 90 },
        "straight 350",
        { type: "right", r: 100, deg: 90 },
        { type: "right", r: 100, deg: 90 },
        "straight 350",
        { type: "left",  r: 100, deg: 90 },
        { type: "left",  r: 100, deg: 90 },
        "straight 350",
        { type: "right", r: 100, deg: 90 },
        { type: "right", r: 200, deg: 45 },
        "straight 400",
        { type: "left", r: 50, deg: 90 },
        "straight 300",
        { type: "right", r: 200, deg: 45 },
        "straight 100",
        { type: "right", r: 100, deg: 135 },
        "straight 300",
        { type: "left",  r: 50, deg: 90 },
        "straight 100",
        { type: "left",  r: 50, deg: 90 },
        "straight 300",
        { type: "right", r: 200, deg: 45 },
        "straight 300",
        { type: "right", r: 200, deg: 45 },
        "straight 500",
        { type: "left",  r: 50, deg: 90 },
        "straight 100",
        { type: "left",  r: 50, deg: 90 },
        "straight 300",
        { type: "right", r: 50, deg: 45 },
        "straight 200",
        { type: "right", r: 50, deg: 135 },
        "straight 800",
      ],

      obstacles: [
        // Exempel (ändra/ta bort):
        { type: "ramp", x: 630, y: 9000, r: 22, strength: 0.5 },
        { type: "ramp", x: 112, y: 8800, r: 22, strength: 0.5 },
        { type: "ramp", x: 207, y: 8246, r: 22, strength: 0.5 },
        { type: "ramp", x: 409, y: 7146, r: 22, strength: 3 },
          ],
  },
  {
    id: "track-008",
    name: "Bouncer",
    worldW: 800,
    worldH: 11000,
    trackW: 700,
    wallMode: "bounce",
    wallBounce: { restitution: 2, friction: 1.0, maxPush: 1200, minKick: 180 },

    speed: {
      base: 0,
      boost: 2000,
      min: -500,
      maxForward: 2000,
      accelUp: 15,
      accelDown: 15
    },

    medals: {
      gold: 5,
      silver: 6,
      bronze: 7
    },

      segments: [
        "straight 9000",
      ],

      obstacles: [
        // Exempel (ändra/ta bort):
        { type: "bounce", x: 100, y: 9500, r: 30, restitution: 3 },
        { type: "bounce", x: 300, y: 9500, r: 30, restitution: 3 },
        { type: "bounce", x: 500, y: 9500, r: 30, restitution: 3 },
        { type: "bounce", x: 700, y: 9500, r: 30, restitution: 3 },
        { type: "bounce", x: 200, y: 9200, r: 27, restitution: 2 },
        { type: "bounce", x: 400, y: 9200, r: 27, restitution: 2 },
        { type: "bounce", x: 600, y: 9200, r: 27, restitution: 2 },
        { type: "bounce", x: 100, y: 8900, r: 27, restitution: 2 },
        { type: "bounce", x: 300, y: 8900, r: 27, restitution: 2 },
        { type: "bounce", x: 500, y: 8900, r: 27, restitution: 2 },
        { type: "bounce", x: 700, y: 8900, r: 27, restitution: 2 },
        { type: "bounce", x: 200, y: 8600, r: 27, restitution: 2 },
        { type: "bounce", x: 400, y: 8600, r: 27, restitution: 2 },
        { type: "bounce", x: 600, y: 8600, r: 27, restitution: 2 },
        { type: "bounce", x: 100, y: 8300, r: 27, restitution: 2 },
        { type: "bounce", x: 300, y: 8300, r: 27, restitution: 2 },
        { type: "bounce", x: 500, y: 8300, r: 27, restitution: 2 },
        { type: "bounce", x: 700, y: 8300, r: 27, restitution: 2 },
        { type: "bounce", x: 200, y: 8000, r: 27, restitution: 2 },
        { type: "bounce", x: 400, y: 8000, r: 27, restitution: 2 },
        { type: "bounce", x: 600, y: 8000, r: 27, restitution: 2 },
        { type: "bounce", x: 100, y: 7700, r: 27, restitution: 2 },
        { type: "bounce", x: 300, y: 7700, r: 27, restitution: 2 },
        { type: "bounce", x: 500, y: 7700, r: 27, restitution: 2 },
        { type: "bounce", x: 700, y: 7700, r: 27, restitution: 2 },
        { type: "bounce", x: 200, y: 7400, r: 27, restitution: 2 },
        { type: "bounce", x: 400, y: 7400, r: 27, restitution: 2 },
        { type: "bounce", x: 600, y: 7400, r: 27, restitution: 2 },
        { type: "bounce", x: 100, y: 7100, r: 27, restitution: 2 },
        { type: "bounce", x: 300, y: 7100, r: 27, restitution: 2 },
        { type: "bounce", x: 500, y: 7100, r: 27, restitution: 2 },
        { type: "bounce", x: 700, y: 7100, r: 27, restitution: 2 },
        { type: "bounce", x: 200, y: 6800, r: 27, restitution: 2 },
        { type: "bounce", x: 400, y: 6800, r: 27, restitution: 2 },
        { type: "bounce", x: 600, y: 6800, r: 27, restitution: 2 },
        { type: "bounce", x: 100, y: 6500, r: 27, restitution: 2 },
        { type: "bounce", x: 300, y: 6500, r: 27, restitution: 2 },
        { type: "bounce", x: 500, y: 6500, r: 27, restitution: 2 },
        { type: "bounce", x: 700, y: 6500, r: 27, restitution: 2 },
        { type: "bounce", x: 200, y: 6200, r: 27, restitution: 2 },
        { type: "bounce", x: 400, y: 6200, r: 27, restitution: 2 },
        { type: "bounce", x: 600, y: 6200, r: 27, restitution: 2 },
          ],
  },
  {
    id: "track-009",
    name: "Timing, man",
    worldW: 800,
    worldH: 11000,
    trackW: 200,

    speed: {
      base: 0,
      boost: 700,
      min: -700,
      maxForward: 700,
      accelUp: 10,
      accelDown: 10
    },

    medals: {
      gold: 10.5,
      silver: 11,
      bronze: 12
    },

      segments: [
        "straight 500",
        { type: "right", r: 100, deg: 90 },
        "straight 300",
        { type: "left", r: 100, deg: 90 },
        "straight 150",
        { type: "left", r: 100, deg: 90 },
        "straight 300",
        { type: "left", r: 1, deg: 90 },
        "straight 100",
        { type: "right", r: 100, deg: 90 },
        { type: "right", r: 100, deg: 90 },
        "straight 1000",


        { type: "right", r: 100, deg: 90 },
        "straight 500",
        { type: "left", r: 100, deg: 90 },
        "straight 2800",
        { type: "left", r: 100, deg: 45 },
        "straight 1000",
        { type: "left", r: 0, deg: 200 },
        "straight 100",
        { type: "right", r: 0, deg: 20 },
        "straight 900",
        { type: "right", r: 100, deg: 45 },
        "straight 2300",
        
        
        { type: "right", r: 100, deg: 90 },
        "straight 600",


        { type: "right", r: 100, deg: 90 },
        "straight 800",
        { type: "right", r: 100, deg: 90 },
        "straight 50",
        { type: "left", r: 100, deg: 90 },
        "straight 50",
        { type: "left", r: 100, deg: 90 },
        "straight 50",
        { type: "right", r: 100, deg: 90 },
        "straight 50",
        "straight 3000",
      ],

      obstacles: [
          {
         type: "ramp", x: 252, y: 15477, r: 22, strength: 0.5,
          interval: {
            startMs: 100,        // börja köra intervall efter 1.5s run-tid (valfri, default 0)
            //endMs: 12000,         // sluta köra intervall efter 12s (valfri, default Infinity)
            periodMs: 2000,       // hela cykeln (måste vara > 0)
            onMs: 700,            // aktiv/kolliderar i början av varje cykel
            telegraphMs: 300,     // ghost innan ON (valfri)
            offsetMs: 0           // fasförskjutning (valfri)
          }
         },
          {
         type: "kill", x: 385, y: 16721, r: 10,        // Exempel (ändra/ta bort):
          interval: {
            startMs: 100,        // börja köra intervall efter 1.5s run-tid (valfri, default 0)
            //endMs: 12000,         // sluta köra intervall efter 12s (valfri, default Infinity)
            periodMs: 1000,       // hela cykeln (måste vara > 0)
            onMs: 700,            // aktiv/kolliderar i början av varje cykel
            telegraphMs: 200,     // ghost innan ON (valfri)
            offsetMs: 0           // fasförskjutning (valfri)
          }
         },
          {
         type: "kill", x: 419, y: 16705, r: 10,        // Exempel (ändra/ta bort):
          interval: {
            startMs: 100,        // börja köra intervall efter 1.5s run-tid (valfri, default 0)
            //endMs: 12000,         // sluta köra intervall efter 12s (valfri, default Infinity)
            periodMs: 1000,       // hela cykeln (måste vara > 0)
            onMs: 700,            // aktiv/kolliderar i början av varje cykel
            telegraphMs: 200,     // ghost innan ON (valfri)
            offsetMs: 0           // fasförskjutning (valfri)
          }
         },
          {
         type: "kill", x: 451, y: 16693, r: 10,        // Exempel (ändra/ta bort):
          interval: {
            startMs: 100,        // börja köra intervall efter 1.5s run-tid (valfri, default 0)
            //endMs: 12000,         // sluta köra intervall efter 12s (valfri, default Infinity)
            periodMs: 1000,       // hela cykeln (måste vara > 0)
            onMs: 700,            // aktiv/kolliderar i början av varje cykel
            telegraphMs: 200,     // ghost innan ON (valfri)
            offsetMs: 0           // fasförskjutning (valfri)
          }
         },
          {
         type: "kill", x: 487, y: 16676, r: 10,        // Exempel (ändra/ta bort):
          interval: {
            startMs: 100,        // börja köra intervall efter 1.5s run-tid (valfri, default 0)
            //endMs: 12000,         // sluta köra intervall efter 12s (valfri, default Infinity)
            periodMs: 1000,       // hela cykeln (måste vara > 0)
            onMs: 700,            // aktiv/kolliderar i början av varje cykel
            telegraphMs: 200,     // ghost innan ON (valfri)
            offsetMs: 0           // fasförskjutning (valfri)
          }
         },
    ],
  },
{
    id: "track-010",
    name: "Gates",
    worldW: 800,
    worldH: 10000,
    trackW: 150,

    speed: {
      base: 0,
      boost: 600,
      min: -600,
      maxForward: 600,
      maxReverse: 0,
      allowReverse: false,
      allowStop: false,
      accelUp: 8,
      accelDown: 8
    },

    medals: {
      gold: 12.5,
      silver: 13,
      bronze: 13.5
    },

    segments: [
        "straight 1500",
        { type: "right", r: 250, deg: 46 },
        "straight 300",
        { type: "left", r: 220, deg: 200 },
        "straight 500",
        { type: "left", r: 220, deg: 15 },
        "straight 300",
        { type: "left", r: 220, deg: 105 },
        "straight 300",
        { type: "left", r: 220, deg: 60 },
        "straight 300",
        { type: "left", r: 220, deg: 90 },
        "straight 300",
        "straight 400",
        { type: "right", r: 220, deg: 60 },
        "straight 300",
        { type: "right", r: 220, deg: 90 },
        "straight 300"
      ],

    obstacles: [
        {
            type: "kill", x: 481, y: 8757, r: 8,
            despawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 481, y: 8721, r: 8,
            despawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 481, y: 8688, r: 8,
            despawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 481, y: 8656, r: 8,
            despawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 316, y: 8760, r: 8,
            despawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 317, y: 8727, r: 8,
            despawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 317, y: 8695, r: 8,
            despawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 317, y: 8663, r: 8,
            despawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        
        
        
        { type: "kill", x: 664, y: 8052, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 689, y: 8028, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 715, y: 8001, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 740, y: 7973, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 761, y: 7949, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 540, y: 7944, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 567, y: 7921, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 595, y: 7894, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 621, y: 7868, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 341, y: 7844, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 357, y: 7814, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 372, y: 7783, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 386, y: 7751, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 193, y: 7769, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 207, y: 7741, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 223, y: 7712, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 237, y: 7681, r: 8,
            despawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        
        
        { type: "kill", x: 346, y: 8795, r: 8,
            spawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 380, y: 8793, r: 8,
            spawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 415, y: 8791, r: 8,
            spawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 448, y: 8788, r: 8,
            spawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 348, y: 8629, r: 8,
            spawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 380, y: 8627, r: 8,
            spawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 414, y: 8625, r: 8,
            spawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        { type: "kill", x: 446, y: 8623, r: 8,
            spawn: {
                zone: { x1: 232, y1: 8640, x2: 287, y2: 8780 },
                edge: "enter",
            }
        },
        
        
        { type: "kill", x: 542, y: 7987, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 569, y: 8010, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 595, y: 8033, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 619, y: 8055, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 662, y: 7857, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 695, y: 7874, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 726, y: 7890, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 755, y: 7907, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 275, y: 7665, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 305, y: 7680, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 334, y: 7694, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 364, y: 7708, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 201, y: 7815, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 230, y: 7831, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 260, y: 7846, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
        { type: "kill", x: 290, y: 7861, r: 8,
            spawn: {
                zone: { x1: 647, y1: 8070, x2: 780, y2: 8140 },
                edge: "enter",
            }
        },
    ],
  },
({
  id: "track-011",
  name: "Reverse 3",
  worldW: 800,
  trackW: 180,
  speed: {
    base: 150,
    boost: 400,
    min: -550,
    maxForward: 550,
    maxReverse: 0,
    accelUp: 8,
    accelDown: 8,
    allowReverse: false,
    allowStop: false
  },
  medals: {
    gold: 13.2,
    silver: 14,
    bronze: 14.5
  },
  segments: [
    {
      type: "line",
      len: 1000
    },
    {
      type: "right",
      r: 167,
      deg: 90
    },
    {
      type: "line",
      len: 100
    },
    {
      type: "left",
      r: 70,
      deg: 90
    },
    {
      type: "line",
      len: 451
    },
    {
      type: "left",
      r: 148,
      deg: 90
    },
    {
      type: "left",
      r: 79,
      deg: 90
    },
    {
      type: "line",
      len: 240
    },
    {
      type: "right",
      r: 105,
      deg: 90
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 391,
      deg: 90
    },
    {
      type: "left",
      r: 122,
      deg: 167
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "line",
      len: 600
    },
    {
      type: "left",
      r: 267,
      deg: 90
    },
    {
      type: "left",
      r: 220,
      deg: 103
    },
    {
      type: "line",
      len: 281
    },
    {
      type: "left",
      r: 107,
      deg: 180
    },
    {
      type: "line",
      len: 1023
    }
  ],
  obstacles: [
    {
      type: "kill",
      x: 260.33901063735874,
      y: 6265.310755153147,
      r: 18,
      restitution: 0,
      strength: 0,
      despawn: {
        zone: {
          x1: 230,
          y1: 6540,
          x2: 405,
          y2: 6650
        },
        edge: "enter"
      }
    },
    {
      type: "kill",
      x: 317,
      y: 6265,
      r: 18,
      restitution: 0,
      strength: 0,
      despawn: {
        zone: {
          x1: 230,
          y1: 6540,
          x2: 405,
          y2: 6650
        },
        edge: "enter"
      }
    },
    {
      type: "kill",
      x: 376,
      y: 6265,
      r: 18,
      restitution: 0,
      strength: 0,
      despawn: {
        zone: {
          x1: 230,
          y1: 6540,
          x2: 405,
          y2: 6650
        },
        edge: "enter"
      }
    },
    {
      type: "kill",
      x: 260,
      y: 6505.762753244159,
      r: 18,
      restitution: 0,
      strength: 0,
      despawn: {
        zone: {
          x1: 230,
          y1: 6540,
          x2: 405,
          y2: 6650
        },
        edge: "enter"
      }
    },
    {
      type: "kill",
      x: 318.1920628089689,
      y: 6500,
      r: 18,
      restitution: 0,
      strength: 0,
      despawn: {
        zone: {
          x1: 230,
          y1: 6540,
          x2: 405,
          y2: 6650
        },
        edge: "enter"
      }
    },
    {
      type: "kill",
      x: 378,
      y: 6496,
      r: 18,
      restitution: 0,
      strength: 0,
      despawn: {
        zone: {
          x1: 230,
          y1: 6540,
          x2: 405,
          y2: 6650
        },
        edge: "enter"
      }
    }
    ]
}),
({
  id: "track-012",
  name: "Slalom",
  worldW: 800,
  trackW: 150,
  speed: {
    base: 200,
    boost: 500,
    min: 0,
    maxForward: 700,
    maxReverse: 0,
    accelUp: 8,
    accelDown: 8,
    allowReverse: false,
    allowStop: false
  },
  medals: {
    gold: 6.250,
    silver: 7,
    bronze: 8
  },
  segments: [
    {
      type: "line",
      len: 600
    },
    {
      type: "left",
      r: 96,
      deg: 90
    },
    {
      type: "line",
      len: 113
    },
    {
      type: "right",
      r: 93,
      deg: 90
    },
    {
      type: "right",
      r: 102,
      deg: 100
    },
    {
      type: "left",
      r: 170,
      deg: 163
    },
    {
      type: "right",
      r: 220,
      deg: 140
    },
    {
      type: "left",
      r: 101,
      deg: 179
    },
    {
      type: "right",
      r: 183,
      deg: 200
    },
    {
      type: "left",
      r: 220,
      deg: 131
    },
    {
      type: "line",
      len: 600
    }
  ],
  obstacles: []
}),
({
  id: "track-013",
  name: "X Track (experimental)",
  worldW: 3000,
  trackW: 150,
  speed: {
    base: 0,
    boost: 800,
    min: -800,
    maxForward: 800,
    maxReverse: 0,
    accelUp: 5,
    accelDown: 5,
    allowReverse: false,
    allowStop: false
  },
  wallMode: "bounce",
  wallBounce: { restitution: 0.01, friction: 0.1, maxPush: 150, minKick: 150 },
  medals: {
    gold: 2.5,
    silver: 3,
    bronze: 4
  },
  segments: [
    {
      type: "line",
      len: 1000
    },
    {
      type: "right",
      r: 200,
      deg: 90
    },
    {
      type: "line",
      len: 249
    },
    {
      type: "left",
      r: 108,
      deg: 180
    },
    {
      type: "line",
      len: 1200
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 131,
      deg: 180
    },
    {
      type: "right",
      r: 382,
      deg: 84
    },
    {
      type: "left",
      r: 220,
      deg: 123
    },
    {
      type: "line",
      len: 600
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "line",
      len: 600
    },
    {
      type: "line",
      len: 703
    },
    {
      type: "left",
      r: 220,
      deg: 51
    },
    {
      type: "line",
      len: 600
    }
  ],
  obstacles: []
}),
({
  id: "track-014",
  name: "Long track (experimental)",
  worldW: 2500,
  trackW: 180,
  wallMode: "bounce",
  wallBounce: { friction: 1, maxPush: 0, minKick: 600, restitution: 0 },
  speed: {
    base: 0,
    boost: 1000,
    min: -400,
    maxForward: 1000,
    maxReverse: 0,
    accelUp: 7,
    accelDown: 7,
    allowReverse: false,
    allowStop: false
  },
  medals: {
    gold: 0,
    silver: 0,
    bronze: 0
  },
  segments: [
    {
      type: "line",
      len: 600
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "line",
      len: 322
    },
    {
      type: "left",
      r: 113,
      deg: 90
    },
    {
      type: "right",
      r: 100,
      deg: 90
    },
    {
      type: "right",
      r: 100,
      deg: 90
    },
    {
      type: "line",
      len: 1000
    },
    {
      type: "right",
      r: 220,
      deg: 90
    },
    {
      type: "line",
      len: 600
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "left",
      r: 220,
      deg: 102
    },
    {
      type: "line",
      len: 759
    },
    {
      type: "right",
      r: 220,
      deg: 246
    },
    {
      type: "left",
      r: 184,
      deg: 151
    },
    {
      type: "right",
      r: 220,
      deg: 144
    },
    {
      type: "line",
      len: 600
    },
    {
      type: "right",
      r: 478,
      deg: 137
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "left",
      r: 220,
      deg: 90
    },
    {
      type: "line",
      len: 600
    },
    {
      type: "left",
      r: 220,
      deg: 94
    },
    {
      type: "line",
      len: 1000
    }
  ],
  obstacles: []
})
];
