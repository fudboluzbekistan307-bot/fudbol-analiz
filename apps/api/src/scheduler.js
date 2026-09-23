// Fon vazifalari:
//  1) Tahlil snapshotlari — o'yinga 72 soat qolgandan boshlab har bosqichda va har 3 soatda saqlanadi.
//  2) Live xabarnomalar — obuna bo'lingan o'yinlarda gol, qizil kartochka, tanaffus, yakun.

const HOUR = 3600_000;

export function startScheduler({ service, store, notify, log = console }) {
  const timers = [];

  async function snapshotTick() {
    try {
      const now = Date.now();
      const upcoming = service
        .listMatches({ from: now, to: now + 72 * HOUR })
        .filter((m) => m.status === 'scheduled');
      let saved = 0;
      for (const m of upcoming) {
        const a = service.getAnalysis(m.id);
        if (!a?.available) continue;
        const last = await store.lastSnapshot(m.id);
        const stale = !last || now - Date.parse(last.created_at) > 3 * HOUR || last.phase !== a.phase.key;
        if (stale) {
          await store.saveSnapshot(m.id, a);
          saved++;
        }
      }
      if (saved) log.info?.(`[scheduler] ${saved} ta tahlil snapshoti saqlandi`);
    } catch (e) {
      log.error?.('[scheduler] snapshot xatosi:', e.message);
    }
  }

  // matchId -> ko'rilgan hodisalar soni va holat
  const seen = new Map();
  async function liveTick() {
    if (!notify) return;
    try {
      const ids = await store.subscribedMatchIds();
      for (const id of ids) {
        const live = service.getLive(id);
        if (!live || live.status === 'scheduled') continue;
        const important = live.events.filter((e) => e.type === 'goal' || e.type === 'red');
        const prev = seen.get(id);
        const state = { count: important.length, period: live.clock.period };
        seen.set(id, state);
        if (!prev) {
          // Birinchi ko'rish: faqat boshlanganini xabar qilamiz (agar hali boshida bo'lsa)
          if (live.clock.period === '1H' && live.clock.slot <= 2) await notify(id, { type: 'kickoff', live });
          continue;
        }
        for (const ev of important.slice(prev.count)) await notify(id, { type: ev.type, event: ev, live });
        if (prev.period !== 'HT' && state.period === 'HT') await notify(id, { type: 'halftime', live });
        if (prev.period !== 'FT' && state.period === 'FT') {
          await notify(id, { type: 'fulltime', live });
        }
      }
    } catch (e) {
      log.error?.('[scheduler] live xatosi:', e.message);
    }
  }

  snapshotTick();
  timers.push(setInterval(snapshotTick, 15 * 60_000));
  timers.push(setInterval(liveTick, 20_000));
  liveTick();

  return () => timers.forEach(clearInterval);
}
