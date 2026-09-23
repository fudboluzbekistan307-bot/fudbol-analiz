// Live simulyator (mock). Haqiqiy API ulanganda live holat provider'dan keladi,
// lekin "o'yin davomida ehtimollar" hisobi (inPlayProbabilities) xuddi shunday ishlatiladi.

import { createRng } from './random.js';
import { scoreMatrix } from './analysis.js';

// Real vaqt jadvali (daqiqa): 1-bo'lim 45+2, tanaffus 15, 2-bo'lim 45+5 => 112
const FIRST_HALF = 47;
const HALF_TIME = 15;
const SECOND_HALF = 50;

/** Real o'tgan vaqtdan o'yin soatini topish. */
export function clockAt(kickoffMs, now) {
  const e = (now - kickoffMs) / 60_000;
  if (e < 0) return { period: 'NS', label: 'Boshlanmagan', slot: 0 };
  if (e < FIRST_HALF) {
    const slot = Math.floor(e) + 1; // 1..47
    return { period: '1H', label: slot > 45 ? `45+${slot - 45}'` : `${slot}'`, slot };
  }
  if (e < FIRST_HALF + HALF_TIME) return { period: 'HT', label: 'Tanaffus', slot: FIRST_HALF };
  const e2 = e - FIRST_HALF - HALF_TIME;
  if (e2 < SECOND_HALF) {
    const slot = FIRST_HALF + Math.floor(e2) + 1; // 48..97
    const minute = 45 + (slot - FIRST_HALF);
    return { period: '2H', label: minute > 90 ? `90+${minute - 90}'` : `${minute}'`, slot };
  }
  return { period: 'FT', label: 'Tugadi', slot: FIRST_HALF + SECOND_HALF };
}

const TOTAL_SLOTS = FIRST_HALF + SECOND_HALF; // 97

function slotLabel(slot) {
  if (slot <= FIRST_HALF) return slot > 45 ? `45+${slot - 45}'` : `${slot}'`;
  const minute = 45 + (slot - FIRST_HALF);
  return minute > 90 ? `90+${minute - 90}'` : `${minute}'`;
}

/** 0..1 — o'yinning qancha qismi o'tgan (slot bo'yicha) */
const progressOf = (slot) => Math.min(1, slot / TOTAL_SLOTS);

/**
 * O'yinning to'liq ssenariysini deterministik generatsiya qiladi.
 * lambdas — o'yin oldi tahlildan kutilayotgan gollar.
 */
export function simulateMatch(match, lambdas, referee) {
  const rng = createRng(`live:${match.id}`);
  const events = [];
  const perSlot = { home: lambdas.home / 90, away: lambdas.away / 90 };
  const red = { home: 0, away: 0 };
  const stats = [];
  const acc = {
    home: { shots: 0, onTarget: 0, corners: 0, fouls: 0, yellow: 0, red: 0, xg: 0 },
    away: { shots: 0, onTarget: 0, corners: 0, fouls: 0, yellow: 0, red: 0, xg: 0 },
  };
  const score = { home: 0, away: 0 };
  const yellowPerSlot = (referee?.avgYellow ?? 4) / 2 / 90;
  const redPerSlot = (referee?.avgRed ?? 0.12) / 2 / 90;
  const subsLeft = { home: 5, away: 5 };

  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const late = slot > 80 ? 1.2 : 1;
    for (const side of ['home', 'away']) {
      const other = side === 'home' ? 'away' : 'home';
      const redAdj = (red[side] ? 0.7 : 1) * (red[other] ? 1.3 : 1);
      // Zarbalar
      const shotP = perSlot[side] * 7 * redAdj * late;
      if (rng.chance(Math.min(0.6, shotP))) {
        const xg = Number(rng.float(0.02, 0.25).toFixed(2));
        acc[side].shots++;
        acc[side].xg += xg;
        const onTarget = rng.chance(0.36);
        if (onTarget) acc[side].onTarget++;
        // Gol ehtimoli: zarba xG ga bog'liq, lekin umumiy λ ga moslashtirilgan
        if (onTarget && rng.chance(Math.min(0.9, xg * 2.75))) {
          score[side]++;
          events.push({
            slot, minute: slotLabel(slot), type: 'goal', side,
            detail: rng.pick(['Jarima maydonchasi ichidan zarba', 'Bosh bilan', 'Uzoqdan zarba', 'Kontratakadan', 'Standart holatdan', 'Penalti']),
            score: `${score.home}:${score.away}`,
          });
        } else if (rng.chance(0.3)) {
          acc[side].corners++;
        }
      }
      if (rng.chance(0.13)) acc[side].fouls++;
      if (rng.chance(yellowPerSlot)) {
        acc[side].yellow++;
        events.push({ slot, minute: slotLabel(slot), type: 'yellow', side, detail: rng.pick(['Qo\'pol o\'yin', 'Taktik qoidabuzarlik', 'Hakam bilan tortishuv']) });
      }
      if (!red[side] && rng.chance(redPerSlot)) {
        red[side] = 1;
        acc[side].red++;
        events.push({ slot, minute: slotLabel(slot), type: 'red', side, detail: "To'g'ridan-to'g'ri qizil kartochka" });
      }
      if (slot > FIRST_HALF + 12 && subsLeft[side] > 0 && rng.chance(0.07)) {
        subsLeft[side]--;
        events.push({ slot, minute: slotLabel(slot), type: 'sub', side, detail: 'Almashtirish' });
      }
    }
    const possHome = Math.round(Math.min(70, Math.max(30, 50 + (lambdas.home - lambdas.away) * 9 + rng.float(-4, 4) + (red.away ? 6 : 0) - (red.home ? 6 : 0))));
    stats.push({
      slot,
      score: { ...score },
      red: { ...red },
      possession: { home: possHome, away: 100 - possHome },
      home: { ...acc.home, xg: Number(acc.home.xg.toFixed(2)) },
      away: { ...acc.away, xg: Number(acc.away.xg.toFixed(2)) },
    });
  }
  return { events, stats };
}

/** O'yin davomida qolgan vaqt uchun ehtimollarni qayta hisoblash. */
export function inPlayProbabilities(lambdas, slot, score, red = { home: 0, away: 0 }) {
  const remaining = 1 - progressOf(slot);
  if (remaining <= 0) {
    return {
      home: score.home > score.away ? 1 : 0,
      draw: score.home === score.away ? 1 : 0,
      away: score.home < score.away ? 1 : 0,
    };
  }
  const lh = lambdas.home * remaining * (red.home ? 0.7 : 1) * (red.away ? 1.3 : 1);
  const la = lambdas.away * remaining * (red.away ? 0.7 : 1) * (red.home ? 1.3 : 1);
  const m = scoreMatrix(Math.max(0.01, lh), Math.max(0.01, la), { offsetHome: score.home, offsetAway: score.away, rho: 0 });
  return { home: m.homeWin, draw: m.draw, away: m.awayWin, nextGoalExpected: Number((lh + la).toFixed(2)) };
}

/** Berilgan vaqtdagi live holat. */
export function liveState(match, lambdas, referee, now = Date.now()) {
  const kickoff = Date.parse(match.kickoff);
  const clock = clockAt(kickoff, now);
  if (clock.period === 'NS') {
    return { matchId: match.id, status: 'scheduled', clock, score: { home: 0, away: 0 }, events: [], stats: null };
  }
  const sim = simulateMatch(match, lambdas, referee);
  const slot = clock.slot;
  const current = sim.stats[Math.max(0, slot - 1)];
  const events = sim.events.filter((e) => e.slot <= slot);
  return {
    matchId: match.id,
    status: clock.period === 'FT' ? 'finished' : 'live',
    clock,
    score: current.score,
    events,
    stats: {
      possession: current.possession,
      home: current.home,
      away: current.away,
    },
    probabilities: inPlayProbabilities(lambdas, slot, current.score, current.red),
    // Grafik uchun: har 5 daqiqada ehtimollar tarixi
    momentum: sim.stats
      .filter((s) => s.slot <= slot && (s.slot % 5 === 0 || s.slot === slot))
      .map((s) => ({ minute: slotLabel(s.slot), ...inPlayProbabilities(lambdas, s.slot, s.score, s.red) })),
  };
}
