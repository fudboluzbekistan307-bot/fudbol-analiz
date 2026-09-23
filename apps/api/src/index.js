// API server: REST + SSE (live) + Telegram bot webhook + production'da web (static) ni ham beradi.

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createService, createProvider, LEAGUES } from '@fa/core';
import { createBot } from '@fa/bot';
import { createStore } from './db.js';
import { startScheduler } from './scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const WEB_DIST = path.resolve(__dirname, '../../web/dist');

const service = createService(createProvider());
const store = await createStore();
console.info(`[api] provider: ${service.providerName}, ombor: ${store.kind}`);

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// --- REST ---
const api = express.Router();

api.get('/health', (_req, res) => res.json({ ok: true, provider: service.providerName, store: store.kind, time: new Date().toISOString() }));

api.get('/leagues', (_req, res) => res.json(LEAGUES));

api.get('/matches', (req, res) => {
  const from = req.query.from ? Date.parse(req.query.from) : undefined;
  const to = req.query.to ? Date.parse(req.query.to) : undefined;
  if ((req.query.from && Number.isNaN(from)) || (req.query.to && Number.isNaN(to))) {
    return res.status(400).json({ error: "from/to noto'g'ri sana" });
  }
  if (from && to && to - from > 14 * 24 * 3600_000) return res.status(400).json({ error: 'Oraliq 14 kundan oshmasin' });
  let list = service.listMatches({ from, to });
  if (req.query.league) list = list.filter((m) => m.league.id === req.query.league);
  if (req.query.status) list = list.filter((m) => m.status === req.query.status);
  res.json(list);
});

api.get('/matches/:id', (req, res) => {
  const m = service.getMatch(req.params.id);
  if (!m) return res.status(404).json({ error: "O'yin topilmadi" });
  res.json(m);
});

api.get('/matches/:id/analysis', (req, res) => {
  const a = service.getAnalysis(req.params.id);
  if (!a) return res.status(404).json({ error: "O'yin topilmadi" });
  res.json(a);
});

api.get('/matches/:id/timeline', async (req, res) => {
  const t = service.getAnalysisTimeline(req.params.id);
  if (!t) return res.status(404).json({ error: "O'yin topilmadi" });
  const snapshots = await store.listSnapshots(req.params.id).catch(() => []);
  res.json({ computed: t, snapshots });
});

api.get('/live', (_req, res) => res.json(service.liveMatches()));

api.get('/matches/:id/live', (req, res) => {
  const l = service.getLive(req.params.id);
  if (!l) return res.status(404).json({ error: "O'yin topilmadi" });
  res.json(l);
});

// --- SSE: live oqim ---
function sse(res, producer, intervalMs) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  let last = '';
  const push = () => {
    try {
      const data = JSON.stringify(producer());
      if (data !== last) {
        res.write(`data: ${data}\n\n`);
        last = data;
      } else {
        res.write(': ping\n\n');
      }
    } catch (e) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: e.message })}\n\n`);
    }
  };
  push();
  const t = setInterval(push, intervalMs);
  res.on('close', () => clearInterval(t));
}

api.get('/live/stream', (_req, res) => sse(res, () => service.liveMatches(), 5000));
api.get('/matches/:id/live/stream', (req, res) => {
  if (!service.getMatch(req.params.id)) return res.status(404).json({ error: "O'yin topilmadi" });
  sse(res, () => service.getLive(req.params.id), 3000);
});

app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Topilmadi' }));

// --- Telegram bot ---
let bot = null;
if (process.env.BOT_TOKEN) {
  bot = createBot({ token: process.env.BOT_TOKEN, service, store, webUrl: PUBLIC_URL });
  if (PUBLIC_URL) {
    const hookPath = `/telegram/${WEBHOOK_SECRET || 'webhook'}`;
    app.post(hookPath, bot.webhook(WEBHOOK_SECRET));
    bot.setWebhook(`${PUBLIC_URL}${hookPath}`, WEBHOOK_SECRET).catch((e) => console.error('[bot] webhook xatosi:', e.message));
  } else {
    bot.startPolling().catch((e) => console.error('[bot] polling xatosi:', e.message));
  }
} else {
  console.info('[bot] BOT_TOKEN yo\'q — bot o\'chirilgan');
}

// --- Web (production build) ---
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
} else {
  app.get('/', (_req, res) => res.type('text').send('API ishlayapti. Web uchun: pnpm build yoki pnpm dev:web'));
}

const stopScheduler = startScheduler({ service, store, notify: bot?.notify });

const server = app.listen(PORT, () => console.info(`[api] http://localhost:${PORT}`));

async function shutdown() {
  console.info('[api] to\'xtatilmoqda...');
  stopScheduler();
  try {
    await bot?.stop();
  } catch {
    /* webhook rejimida polling yo'q */
  }
  server.close();
  await store.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
