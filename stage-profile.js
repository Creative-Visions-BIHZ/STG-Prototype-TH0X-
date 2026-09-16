// Stage data is intentionally separate from the engine. Times are measured in
// active stage seconds; the clock pauses while a boss encounter is running.
globalThis.STG_STAGE = Object.freeze({
  bossName: "The Astral Visitor",
  initialBossHp: 400,

  events: Object.freeze([
    // Opening section: enough formations and mixed groups to establish power.
    { at: 1, type: "formation", count: 6, shape: "v" },
    { at: 5, type: "mixed", count: 4 },
    { at: 10, type: "formation", count: 8, shape: "line" },
    { at: 15, type: "mixed", count: 5 },
    { at: 20, type: "formation", count: 10, shape: "v" },
    { at: 25, type: "mixed", count: 6 },
    { at: 30, type: "formation", count: 10, shape: "line" },
    { at: 35, type: "mixed", count: 6 },
    { at: 40, type: "formation", count: 12, shape: "v" },
    { at: 45, type: "mixed", count: 6 },
    { at: 51, type: "boss", encounter: "initial" },

    // Second section: continues building power before the spell-card battle.
    { at: 58, type: "formation", count: 10, shape: "line" },
    { at: 63, type: "mixed", count: 5 },
    { at: 68, type: "formation", count: 12, shape: "v" },
    { at: 73, type: "mixed", count: 6 },
    { at: 78, type: "formation", count: 12, shape: "line" },
    { at: 83, type: "mixed", count: 6 },
    { at: 90, type: "boss", encounter: "final" }
  ]),

  spellCards: Object.freeze([
    { name: "Petal Geometry", hp: 480 },
    { name: "Crossing Stars", hp: 620 },
    { name: "Last Light of the Orrery", hp: 780 }
  ])
});
