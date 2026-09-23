// Telegram bot (Grammy). API server ichida ishga tushadi:
//  - dev: long polling
//  - production (PUBLIC_URL bor): webhook — Render free tier'da alohida worker kerak bo'lmaydi.

import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import { matchCard, factorsText, liveText, buttonLabel, date, esc } from './format.js';

const HOUR = 3600_000;
const TZ_OFFSET_HOURS = Number(process.env.BOT_TZ_OFFSET_HOURS ?? 5); // Toshkent UTC+5

const DAY_NAMES = ['Bugun', 'Ertaga', 'Indinga'];

function dayRange(offset) {
  const shifted = Date.now() + TZ_OFFSET_HOURS * HOUR;
  const startLocal = Math.floor(shifted / (24 * HOUR)) * 24 * HOUR + offset * 24 * HOUR;
  const from = startLocal - TZ_OFFSET_HOURS * HOUR;
  return { from, to: from + 24 * HOUR - 1 };
}

export function createBot({ token, service, store, webUrl, log = console }) {
  const bot = new Bot(token);

  const mainMenu = () => {
    const kb = new InlineKeyboard().text("📅 Bugungi o'yinlar", 'd:0').text('🔴 Live', 'live').row().text('🔔 Obunalarim', 'subs');
    if (webUrl?.startsWith('https://')) kb.row().webApp('🌐 Platformani ochish', webUrl);
    return kb;
  };

  async function dayList(offset) {
    const { from, to } = dayRange(offset);
    const matches = service.listMatches({ from, to }).filter((m) => !m.demo || offset === 0);
    const kb = new InlineKeyboard();
    for (const m of matches.slice(0, 40)) kb.text(buttonLabel(m), `m:${m.id}`).row();
    if (offset > 0) kb.text('⬅️', `d:${offset - 1}`);
    if (offset < 6) kb.text('➡️', `d:${offset + 1}`);
    kb.row().text('🏠 Menyu', 'menu');
    const title = DAY_NAMES[offset] ?? date(new Date(from + TZ_OFFSET_HOURS * HOUR).toISOString());
    const text = matches.length
      ? `📅 <b>${title}</b> — ${matches.length} ta o'yin.\nTahlil uchun o'yinni tanlang. (Tahlil o'yindan 3 kun oldin ochiladi.)`
      : `📅 <b>${title}</b> — o'yinlar yo'q.`;
    return { text, kb };
  }

  async function matchView(id, chatId) {
    const m = service.getMatch(id);
    if (!m) return null;
    const a = service.getAnalysis(id);
    const subscribed = chatId ? (await store.subscriptionsOf(chatId)).includes(id) : false;
    const kb = new InlineKeyboard();
    if (a?.available) kb.text('📋 Barcha omillar', `f:${id}`);
    if (m.status !== 'scheduled') kb.text('🔴 Live holat', `l:${id}`);
    kb.row();
    if (m.status !== 'finished') kb.text(subscribed ? "🔕 Kuzatishni to'xtatish" : '🔔 Live xabarnomalar', `${subscribed ? 'u' : 's'}:${id}`).row();
    if (webUrl?.startsWith('https://')) kb.webApp('🌐 Saytda ochish', `${webUrl}/match/${id}`).row();
    kb.text('⬅️ Orqaga', 'd:0').text('🔄', `m:${id}`);
    return { text: matchCard(m, a), kb };
  }

  const send = (ctx, view) =>
    ctx.callbackQuery
      ? ctx.editMessageText(view.text, { parse_mode: 'HTML', reply_markup: view.kb }).catch((e) => {
          if (!String(e.description || e.message).includes('message is not modified')) throw e;
        })
      : ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.kb });

  bot.use(async (ctx, next) => {
    if (ctx.chat?.id) {
      store.upsertUser({ chatId: ctx.chat.id, username: ctx.from?.username, firstName: ctx.from?.first_name }).catch(() => {});
    }
    await next();
  });

  bot.command('start', (ctx) =>
    ctx.reply(
      `Assalomu alaykum, ${esc(ctx.from?.first_name ?? '')}! ⚽\n\n` +
        "Bu bot futbol o'yinlarini chuqur tahlil qiladi: forma, jarohatlar, ob-havo, dam olish kunlari, hakam, motivatsiya va boshqa kichik detallar.\n\n" +
        "• Tahlil o'yindan <b>3 kun oldin</b> boshlanadi va o'yin yaqinlashgan sari yangilanadi\n" +
        "• Live o'yinlarda gol va qizil kartochkalar haqida xabar beraman\n\n" +
        'Buyruqlar: /bugun, /live, /obunalar',
      { parse_mode: 'HTML', reply_markup: mainMenu() },
    ),
  );
  bot.command(['bugun', 'today'], async (ctx) => send(ctx, await dayList(0)));
  bot.command('ertaga', async (ctx) => send(ctx, await dayList(1)));
  bot.command('live', async (ctx) => send(ctx, liveListView()));
  bot.command('obunalar', async (ctx) => send(ctx, await subsView(ctx.chat.id)));

  function liveListView() {
    const live = service.liveMatches();
    const kb = new InlineKeyboard();
    for (const m of live) kb.text(buttonLabel(m), `l:${m.id}`).row();
    kb.text('🔄 Yangilash', 'live').text('🏠 Menyu', 'menu');
    return { text: live.length ? `🔴 <b>Hozir ${live.length} ta o'yin ketmoqda</b>` : "Hozir live o'yin yo'q.", kb };
  }

  async function subsView(chatId) {
    const ids = await store.subscriptionsOf(chatId);
    const matches = ids.map((id) => service.getMatch(id)).filter(Boolean).filter((m) => m.status !== 'finished');
    const kb = new InlineKeyboard();
    for (const m of matches) kb.text(buttonLabel(m), `m:${m.id}`).row();
    kb.text('🏠 Menyu', 'menu');
    return {
      text: matches.length ? `🔔 <b>Kuzatilayotgan o'yinlar</b> (${matches.length})` : "🔕 Hozircha obuna yo'q. O'yinni ochib «🔔 Live xabarnomalar» tugmasini bosing.",
      kb,
    };
  }

  bot.callbackQuery('menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await send(ctx, { text: '🏠 Asosiy menyu', kb: mainMenu() });
  });
  bot.callbackQuery('live', async (ctx) => {
    await ctx.answerCallbackQuery();
    await send(ctx, liveListView());
  });
  bot.callbackQuery('subs', async (ctx) => {
    await ctx.answerCallbackQuery();
    await send(ctx, await subsView(ctx.chat.id));
  });
  bot.callbackQuery(/^d:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await send(ctx, await dayList(Number(ctx.match[1])));
  });
  bot.callbackQuery(/^m:(.+)$/, async (ctx) => {
    const view = await matchView(ctx.match[1], ctx.chat?.id);
    await ctx.answerCallbackQuery(view ? undefined : { text: "O'yin topilmadi" });
    if (view) await send(ctx, view);
  });
  bot.callbackQuery(/^f:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = ctx.match[1];
    const m = service.getMatch(id);
    if (!m) return;
    await send(ctx, { text: factorsText(m, service.getAnalysis(id)), kb: new InlineKeyboard().text('⬅️ Orqaga', `m:${id}`) });
  });
  bot.callbackQuery(/^l:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = ctx.match[1];
    const m = service.getMatch(id);
    if (!m) return;
    await send(ctx, { text: liveText(m, service.getLive(id)), kb: new InlineKeyboard().text('🔄 Yangilash', `l:${id}`).text('⬅️ Orqaga', `m:${id}`) });
  });
  bot.callbackQuery(/^([su]):(.+)$/, async (ctx) => {
    const [, op, id] = ctx.match;
    if (op === 's') await store.subscribe(ctx.chat.id, id);
    else await store.unsubscribe(ctx.chat.id, id);
    await ctx.answerCallbackQuery({ text: op === 's' ? "🔔 Obuna bo'ldingiz — gol va qizil kartochkalar haqida xabar beraman" : "🔕 Obuna bekor qilindi" });
    const view = await matchView(id, ctx.chat.id);
    if (view) await send(ctx, view);
  });

  bot.catch((err) => log.error?.('[bot] xato:', err.error?.message ?? err.message));

  /** Scheduler chaqiradi: obunachilarga live xabar yuborish. */
  async function notify(matchId, payload) {
    const m = service.getMatch(matchId);
    if (!m) return;
    const { live } = payload;
    const score = `${esc(m.home.name)} ${live.score.home}:${live.score.away} ${esc(m.away.name)}`;
    let text;
    switch (payload.type) {
      case 'kickoff': text = `▶️ O'yin boshlandi!\n<b>${score}</b>`; break;
      case 'goal': {
        const team = payload.event.side === 'home' ? m.home.name : m.away.name;
        const atGoal = `${esc(m.home.name)} ${payload.event.score} ${esc(m.away.name)}`;
        text = `⚽ <b>GOL!</b> ${payload.event.minute} — ${esc(team)}\n<b>${atGoal}</b>\n${esc(payload.event.detail)}`;
        break;
      }
      case 'red': {
        const team = payload.event.side === 'home' ? m.home.name : m.away.name;
        text = `🟥 Qizil kartochka! ${payload.event.minute} — ${esc(team)}\n${score}`;
        break;
      }
      case 'halftime': text = `⏸ Tanaffus\n<b>${score}</b>`; break;
      case 'fulltime': text = `🏁 O'yin tugadi\n<b>${score}</b>`; break;
      default: return;
    }
    if (live.probabilities && payload.type !== 'fulltime') {
      const p = live.probabilities;
      text += `\n📊 ${Math.round(p.home * 100)}% / ${Math.round(p.draw * 100)}% / ${Math.round(p.away * 100)}%`;
    }
    const chatIds = await store.subscribersOf(matchId);
    for (const chatId of chatIds) {
      await bot.api
        .sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🔴 Live holat', `l:${matchId}`) })
        .catch((e) => log.warn?.(`[bot] ${chatId} ga yuborilmadi: ${e.description ?? e.message}`));
    }
  }

  async function setCommands() {
    await bot.api.setMyCommands([
      { command: 'bugun', description: "Bugungi o'yinlar va tahlillar" },
      { command: 'ertaga', description: "Ertangi o'yinlar" },
      { command: 'live', description: "Hozir ketayotgan o'yinlar" },
      { command: 'obunalar', description: "Kuzatilayotgan o'yinlar" },
    ]).catch(() => {});
  }

  return {
    bot,
    notify,
    /** Webhook uchun Express middleware */
    webhook: (secret) => webhookCallback(bot, 'express', { secretToken: secret || undefined }),
    async startPolling() {
      await setCommands();
      await bot.api.deleteWebhook().catch(() => {});
      bot.start({ drop_pending_updates: true, onStart: (me) => log.info?.(`[bot] @${me.username} polling rejimida ishga tushdi`) });
    },
    async setWebhook(url, secret) {
      await setCommands();
      await bot.api.setWebhook(url, { secret_token: secret || undefined, drop_pending_updates: true });
      log.info?.(`[bot] webhook o'rnatildi: ${url}`);
    },
    stop: () => bot.stop(),
  };
}
