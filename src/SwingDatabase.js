import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('drc_swing_engine.db');

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS swing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      club_tag TEXT NOT NULL,
      tempo_ratio REAL NOT NULL,
      backswing_ms INTEGER NOT NULL,
      downswing_ms INTEGER NOT NULL,
      peak_linear_g REAL NOT NULL,
      verdict TEXT NOT NULL
    );
  `);
}

export function saveSwing({ clubTag, metrics }) {
  db.runSync(
    `INSERT INTO swing_history
      (timestamp, club_tag, tempo_ratio, backswing_ms, downswing_ms, peak_linear_g, verdict)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      Date.now(),
      clubTag,
      Number(metrics.tempoRatio),
      Number(metrics.backswingMs),
      Number(metrics.downswingMs),
      Number(metrics.peakLinearG),
      metrics.verdict
    ]
  );
}

export function getRecentSwings(limit = 20) {
  return db.getAllSync(
    'SELECT * FROM swing_history ORDER BY timestamp DESC LIMIT ?;',
    [limit]
  );
}

export function getPerformanceSummary() {
  const row = db.getFirstSync(`
    SELECT
      COUNT(*) AS total,
      AVG(tempo_ratio) AS avg_tempo,
      AVG(peak_linear_g) AS avg_g,
      SUM(CASE WHEN verdict = 'ON TEMPO' THEN 1 ELSE 0 END) AS on_tempo
    FROM swing_history;
  `);

  const total = Number(row?.total || 0);
  return {
    total,
    averageTempo: Number(row?.avg_tempo || 0),
    averageLinearG: Number(row?.avg_g || 0),
    onTempoPercent: total ? Math.round((Number(row?.on_tempo || 0) / total) * 100) : 0
  };
}
