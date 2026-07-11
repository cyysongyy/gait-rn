import * as SQLite from 'expo-sqlite';

const DB_NAME = 'gait.db';
let _db = null;

async function getDB() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      date_label TEXT,
      type TEXT DEFAULT 'walk',
      score INTEGER,
      grade TEXT,
      sway REAL,
      duration INTEGER,
      avg_gamma REAL,
      step_count INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
  `);
  return _db;
}

// ── Sessions ──
export async function saveSession(data) {
  const db = await getDB();
  const result = await db.runAsync(
    `INSERT INTO sessions (date, date_label, type, score, grade, sway, duration, avg_gamma, step_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.date || new Date().toISOString(),
      data.dateLabel || todayLabel(),
      data.type || 'walk',
      data.score ?? null,
      data.grade ?? null,
      data.sway ?? null,
      data.duration ?? null,
      data.avgGamma ?? null,
      data.stepCount ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function getSessions(limit = 100) {
  const db = await getDB();
  return await db.getAllAsync(
    `SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function getSessionsByDateRange(from, to) {
  const db = await getDB();
  return await db.getAllAsync(
    `SELECT * FROM sessions WHERE date >= ? AND date <= ? ORDER BY created_at DESC`,
    [from, to]
  );
}

export async function getStats() {
  const db = await getDB();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [week, allTime] = await Promise.all([
    db.getAllAsync(
      `SELECT COUNT(*) as count, AVG(score) as avgScore, MAX(score) as bestScore,
              SUM(duration) as totalDur
       FROM sessions WHERE type='walk' AND date >= ? AND score IS NOT NULL`,
      [weekAgo]
    ),
    db.getAllAsync(
      `SELECT COUNT(*) as count, MAX(score) as bestScore, SUM(duration) as totalDur
       FROM sessions WHERE score IS NOT NULL`
    ),
  ]);
  return { week: week[0], allTime: allTime[0] };
}

export async function exportCSV() {
  const sessions = await getSessions(500);
  const header = '日期,類型,分數,評級,晃動(°),時長(秒),平均偏移(°)\n';
  const rows = sessions.map(s =>
    [s.date, s.type, s.score ?? '', s.grade ?? '', s.sway ?? '',
     s.duration ?? '', s.avg_gamma ?? ''].join(',')
  ).join('\n');
  return header + rows;
}

// ── Settings ──
export async function getSetting(key, defaultVal = null) {
  const db = await getDB();
  const row = await db.getFirstAsync(
    `SELECT value FROM settings WHERE key = ?`, [key]
  );
  if (!row) return defaultVal;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export async function saveSetting(key, value) {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [key, JSON.stringify(value)]
  );
}

// ── Helpers ──
export function todayLabel() {
  return new Date().toLocaleDateString('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short'
  });
}
