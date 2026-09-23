// Ma'lumotlar ombori: DATABASE_URL bo'lsa PostgreSQL, bo'lmasa xotira (dev uchun).

import pg from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS analysis_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  match_id      TEXT NOT NULL,
  phase         TEXT NOT NULL,
  probabilities JSONB NOT NULL,
  expected_goals JSONB NOT NULL,
  confidence    REAL NOT NULL,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analysis_snapshots_match_idx ON analysis_snapshots (match_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bot_users (
  chat_id    BIGINT PRIMARY KEY,
  username   TEXT,
  first_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot_subscriptions (
  chat_id    BIGINT NOT NULL,
  match_id   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, match_id)
);
`;

function memoryStore() {
  const snapshots = [];
  const users = new Map();
  const subs = new Map(); // matchId -> Set(chatId)
  return {
    kind: 'memory',
    async init() {},
    async saveSnapshot(matchId, a) {
      snapshots.push({ match_id: matchId, phase: a.phase.key, probabilities: a.probabilities, expected_goals: a.expectedGoals, confidence: a.confidence, created_at: new Date().toISOString() });
      if (snapshots.length > 5000) snapshots.shift();
    },
    async lastSnapshot(matchId) {
      for (let i = snapshots.length - 1; i >= 0; i--) if (snapshots[i].match_id === matchId) return snapshots[i];
      return null;
    },
    async listSnapshots(matchId) {
      return snapshots.filter((s) => s.match_id === matchId);
    },
    async upsertUser(u) {
      users.set(u.chatId, u);
    },
    async subscribe(chatId, matchId) {
      if (!subs.has(matchId)) subs.set(matchId, new Set());
      subs.get(matchId).add(chatId);
    },
    async unsubscribe(chatId, matchId) {
      subs.get(matchId)?.delete(chatId);
    },
    async subscribersOf(matchId) {
      return [...(subs.get(matchId) ?? [])];
    },
    async subscriptionsOf(chatId) {
      return [...subs.entries()].filter(([, set]) => set.has(chatId)).map(([m]) => m);
    },
    async subscribedMatchIds() {
      return [...subs.entries()].filter(([, set]) => set.size).map(([m]) => m);
    },
    async close() {},
  };
}

function pgStore(url) {
  const pool = new pg.Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    max: 5,
  });
  const q = (text, params) => pool.query(text, params);
  return {
    kind: 'postgres',
    async init() {
      await q(SCHEMA);
    },
    async saveSnapshot(matchId, a) {
      await q(
        `INSERT INTO analysis_snapshots (match_id, phase, probabilities, expected_goals, confidence, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [matchId, a.phase.key, a.probabilities, a.expectedGoals, a.confidence, { verdict: a.verdict, factors: a.factors }],
      );
    },
    async lastSnapshot(matchId) {
      const r = await q(`SELECT * FROM analysis_snapshots WHERE match_id = $1 ORDER BY created_at DESC LIMIT 1`, [matchId]);
      return r.rows[0] ?? null;
    },
    async listSnapshots(matchId) {
      const r = await q(
        `SELECT match_id, phase, probabilities, expected_goals, confidence, created_at
         FROM analysis_snapshots WHERE match_id = $1 ORDER BY created_at ASC LIMIT 200`,
        [matchId],
      );
      return r.rows;
    },
    async upsertUser({ chatId, username, firstName }) {
      await q(
        `INSERT INTO bot_users (chat_id, username, first_name) VALUES ($1, $2, $3)
         ON CONFLICT (chat_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name`,
        [chatId, username ?? null, firstName ?? null],
      );
    },
    async subscribe(chatId, matchId) {
      await q(`INSERT INTO bot_subscriptions (chat_id, match_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [chatId, matchId]);
    },
    async unsubscribe(chatId, matchId) {
      await q(`DELETE FROM bot_subscriptions WHERE chat_id = $1 AND match_id = $2`, [chatId, matchId]);
    },
    async subscribersOf(matchId) {
      const r = await q(`SELECT chat_id FROM bot_subscriptions WHERE match_id = $1`, [matchId]);
      return r.rows.map((x) => Number(x.chat_id));
    },
    async subscriptionsOf(chatId) {
      const r = await q(`SELECT match_id FROM bot_subscriptions WHERE chat_id = $1 ORDER BY created_at DESC`, [chatId]);
      return r.rows.map((x) => x.match_id);
    },
    async subscribedMatchIds() {
      const r = await q(`SELECT DISTINCT match_id FROM bot_subscriptions`);
      return r.rows.map((x) => x.match_id);
    },
    async close() {
      await pool.end();
    },
  };
}

export async function createStore(url = process.env.DATABASE_URL) {
  const store = url ? pgStore(url) : memoryStore();
  await store.init();
  return store;
}
