// Stage data is intentionally separate from the engine. Times are measured in
// active stage seconds; the clock pauses while a boss encounter is running.
globalThis.STG_STAGES = Object.freeze([
  Object.freeze({
    title: "Stage 1 · Starfall Shrine", bossName: "The Astral Visitor",
    enemyHpScale: 1, initialBossHp: 400,
    events: Object.freeze([
      { at: 1, type: "formation", count: 6, shape: "v" }, { at: 5, type: "mixed", count: 4 },
      { at: 10, type: "formation", count: 8, shape: "line" }, { at: 15, type: "mixed", count: 5 },
      { at: 20, type: "formation", count: 10, shape: "v" }, { at: 25, type: "mixed", count: 6 },
      { at: 30, type: "formation", count: 10, shape: "line" }, { at: 35, type: "mixed", count: 6 },
      { at: 40, type: "formation", count: 12, shape: "v" }, { at: 45, type: "mixed", count: 6 },
      { at: 51, type: "boss", encounter: "initial" },
      { at: 58, type: "formation", count: 10, shape: "line" }, { at: 63, type: "mixed", count: 5 },
      { at: 68, type: "formation", count: 12, shape: "v" }, { at: 73, type: "mixed", count: 6 },
      { at: 78, type: "formation", count: 12, shape: "line" }, { at: 83, type: "mixed", count: 6 },
      { at: 90, type: "boss", encounter: "final" }
    ]),
    initialCards: Object.freeze([]),
    finalCards: Object.freeze([
      { name: "Petal Geometry", hp: 480, pattern: "petal" },
      { name: "Crossing Stars", hp: 620, pattern: "crossing" },
      { name: "Last Light of the Orrery", hp: 780, pattern: "orrery" }
    ])
  }),
  Object.freeze({
    title: "Stage 2 · Palace of Bent Time", bossName: "Mizuki, Keeper of the Second Hand",
    enemyHpScale: .68, initialBossHp: 360,
    events: Object.freeze([
      { at: 1, type: "formation", count: 10, shape: "line" }, { at: 4, type: "formation", count: 10, shape: "v" },
      { at: 7, type: "mixed", count: 6 }, { at: 10, type: "formation", count: 12, shape: "line" },
      { at: 13, type: "mixed", count: 7 }, { at: 16, type: "formation", count: 14, shape: "v" },
      { at: 20, type: "mixed", count: 8 }, { at: 24, type: "boss", encounter: "initial" },
      { at: 28, type: "formation", count: 12, shape: "line" }, { at: 31, type: "mixed", count: 7 },
      { at: 34, type: "formation", count: 14, shape: "v" }, { at: 37, type: "formation", count: 14, shape: "line" },
      { at: 40, type: "mixed", count: 8 }, { at: 43, type: "formation", count: 16, shape: "v" },
      { at: 47, type: "mixed", count: 9 }, { at: 51, type: "boss", encounter: "final" }
    ]),
    // Exact totals: Easy 0, Normal/Hard 1, Lunatic 2.
    initialCards: Object.freeze([
      { name: "Bent Light — Crescent Refrain", hp: 390, pattern: "crescent", minDifficulty: "normal" },
      { name: "Parallax — Twin Recall", hp: 430, pattern: "twinRecall", minDifficulty: "lunatic" }
    ]),
    // Exact totals: Easy 3, Normal 4, Hard/Lunatic 5.
    finalCards: Object.freeze([
      { name: "Second Echo — Returning Comets", hp: 470, pattern: "secondEcho" },
      { name: "Lattice Sign — Ninefold Star Loom", hp: 520, pattern: "lattice" },
      { name: "Frozen Chorus — Stillpoint Constellation", hp: 570, pattern: "freeze" },
      { name: "Refraction Sign — Split-Mirror Rain", hp: 620, pattern: "mirror", minDifficulty: "normal" },
      { name: "Last Word — Clockwork Reversal", hp: 700, pattern: "reversal", minDifficulty: "hard" }
    ])
  })
]);

globalThis.STG_STAGE = globalThis.STG_STAGES[0];
