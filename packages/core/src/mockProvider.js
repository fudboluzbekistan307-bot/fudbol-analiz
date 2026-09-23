// Mock ma'lumot manbai. Haqiqiy API (masalan API-Football) ulanganda xuddi shu
// interfeysni amalga oshiruvchi yangi provider yoziladi — qolgan kod o'zgarmaydi.
//
// Provider interfeysi:
//   listMatches({ from, to, now })  -> Match[]
//   getMatch(id, now)               -> Match | null
//   getContext(match, now)          -> MatchContext (forma, jarohatlar, ob-havo, H2H, jadval, hakam...)
//
// Hamma narsa deterministik: bir xil kun/o'yin uchun har safar bir xil ma'lumot chiqadi.

import { createRng } from './random.js';
import { LEAGUES, TEAMS, squadFor, teamById, leagueById } from './teams.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const DEMO_SLOT = 2 * HOUR;

// Liga bo'yicha boshlanish vaqtlari (UTC soat, daqiqa)
const KICKOFF_SLOTS = {
  epl: [[11, 30], [14, 0], [16, 30], [19, 0]],
  laliga: [[12, 0], [14, 15], [16, 30], [19, 0]],
  uzsl: [[11, 0], [13, 0], [14, 30], [16, 0]],
};

// Hakamlar ham to'qima (mock) — haqiqiy API ulanganda haqiqiy statistikasi keladi
const REFEREES = [
  { name: 'Rustam Ergashev', avgYellow: 3.6, avgRed: 0.12, penaltiesPerGame: 0.28 },
  { name: 'Daniel Moore', avgYellow: 4.1, avgRed: 0.15, penaltiesPerGame: 0.31 },
  { name: 'Carlos Ibarra', avgYellow: 5.4, avgRed: 0.22, penaltiesPerGame: 0.34 },
  { name: 'Peter Collins', avgYellow: 3.4, avgRed: 0.09, penaltiesPerGame: 0.22 },
  { name: 'Anvar Qodirov', avgYellow: 4.6, avgRed: 0.18, penaltiesPerGame: 0.30 },
  { name: 'Javier Ortega', avgYellow: 5.1, avgRed: 0.2, penaltiesPerGame: 0.27 },
];

const WEATHER_CONDITIONS = [
  { key: 'clear', label: 'Ochiq osmon', icon: '☀️', precip: [0, 0] },
  { key: 'cloudy', label: 'Bulutli', icon: '☁️', precip: [0, 0.2] },
  { key: 'rain', label: "Yomg'ir", icon: '🌧️', precip: [1, 5] },
  { key: 'heavy_rain', label: "Kuchli yomg'ir", icon: '⛈️', precip: [6, 15] },
  { key: 'fog', label: 'Tuman', icon: '🌫️', precip: [0, 0.5] },
];

export const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);

function fixturesForDay(key, league) {
  const rng = createRng(`fix:${league.id}:${key}`);
  if (!rng.chance(0.65)) return [];
  const teams = rng.shuffle(TEAMS.filter((t) => t.leagueId === league.id));
  const count = rng.int(2, 3);
  const slots = rng.shuffle(KICKOFF_SLOTS[league.id]).slice(0, count).sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
  const dayStart = Date.parse(`${key}T00:00:00Z`);
  return slots.map(([h, m], i) => ({
    id: `${league.id}_${key}_${i}`,
    leagueId: league.id,
    homeId: teams[i * 2].id,
    awayId: teams[i * 2 + 1].id,
    kickoff: dayStart + h * HOUR + m * 60_000,
  }));
}

/** Demo uchun: har 2 soatda bitta o'yin — sayt ochilganda doim live o'yin bo'lishi uchun. */
function demoFixture(slot) {
  const rng = createRng(`demo:${slot}`);
  const teams = rng.shuffle(TEAMS.filter((t) => t.leagueId === 'uzsl'));
  return {
    id: `demo_${slot}`,
    leagueId: 'uzsl',
    homeId: teams[0].id,
    awayId: teams[1].id,
    kickoff: slot * DEMO_SLOT + 5 * 60_000,
    demo: true,
  };
}

// O'yin davomiyligi (real vaqt, daqiqa): 1-bo'lim 47, tanaffus 15, 2-bo'lim 50 => 112
export const MATCH_REAL_MINUTES = 112;

export function statusAt(kickoff, now) {
  if (now < kickoff) return 'scheduled';
  if (now < kickoff + MATCH_REAL_MINUTES * 60_000) return 'live';
  return 'finished';
}

function hydrate(fx, now) {
  const home = teamById(fx.homeId);
  const away = teamById(fx.awayId);
  return {
    id: fx.id,
    league: leagueById(fx.leagueId),
    home,
    away,
    kickoff: new Date(fx.kickoff).toISOString(),
    venue: { stadium: home.stadium, city: home.city },
    status: statusAt(fx.kickoff, now),
    demo: Boolean(fx.demo),
  };
}

function rawFixturesBetween(from, to, now = null) {
  const out = [];
  for (let t = Date.parse(`${dayKey(from)}T00:00:00Z`); t <= to; t += DAY) {
    const key = dayKey(t);
    for (const league of LEAGUES) out.push(...fixturesForDay(key, league));
  }
  // Demo o'yinlar faqat hozirgi vaqt atrofida (oldingi, joriy va keyingi slot)
  if (now != null) {
    const cur = Math.floor(now / DEMO_SLOT);
    for (let s = cur - 1; s <= cur + 1; s++) out.push(demoFixture(s));
  }
  return out.filter((f) => f.kickoff >= from && f.kickoff <= to).sort((a, b) => a.kickoff - b.kickoff);
}

function lastMatchBefore(teamId, ts) {
  const fixtures = rawFixturesBetween(ts - 12 * DAY, ts - 1).filter((f) => !f.demo);
  const mine = fixtures.filter((f) => f.homeId === teamId || f.awayId === teamId);
  return mine.length ? mine[mine.length - 1] : null;
}

function formFor(team, seed) {
  const rng = createRng(`form:${team.id}:${seed}`);
  const pWin = Math.min(0.8, Math.max(0.15, 0.38 + (team.rating - 1750) / 600));
  const pDraw = 0.26;
  const opponents = TEAMS.filter((t) => t.leagueId === team.leagueId && t.id !== team.id);
  return Array.from({ length: 5 }, () => {
    const r = rng.next();
    const result = r < pWin ? 'W' : r < pWin + pDraw ? 'D' : 'L';
    let gf = rng.int(0, 3);
    let ga = rng.int(0, 2);
    if (result === 'W' && gf <= ga) gf = ga + 1;
    if (result === 'L' && ga <= gf) ga = gf + 1;
    if (result === 'D') ga = gf;
    return { result, gf, ga, opponent: rng.pick(opponents).name, xg: Number((gf * 0.7 + rng.float(0.2, 1.1)).toFixed(2)) };
  });
}

function standingsFor(leagueId, seasonSeed) {
  const rng = createRng(`table:${leagueId}:${seasonSeed}`);
  const played = 6 + (seasonSeed % 20);
  const rows = TEAMS.filter((t) => t.leagueId === leagueId).map((t) => {
    const ppg = 1.35 + (t.rating - 1750) / 280 + rng.float(-0.35, 0.35);
    const points = Math.max(0, Math.round(played * Math.min(2.7, Math.max(0.4, ppg))));
    const gf = Math.round(played * (1.3 * t.attack + rng.float(-0.2, 0.2)));
    const ga = Math.round(played * (1.3 * t.defense + rng.float(-0.2, 0.2)));
    return { teamId: t.id, team: t.name, played, points, goalsFor: gf, goalsAgainst: ga };
  });
  rows.sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst));
  return rows.map((r, i) => ({ ...r, position: i + 1, total: rows.length }));
}

function injuriesFor(team, matchId, hoursToKickoff) {
  const squad = squadFor(team, createRng(`squad:${team.id}`));
  const rng = createRng(`inj:${matchId}:${team.id}`);
  const n = rng.int(0, 3);
  const players = rng.shuffle(squad).slice(0, n);
  return players.map((p) => {
    const kind = rng.pick(['injury', 'injury', 'suspension', 'doubtful']);
    const recovers = rng.chance(0.5); // har doim tortiladi — ro'yxat bosqichdan qat'i nazar bir xil qoladi
    const reason = rng.pick(['Son mushagi', "Tizza bog'lami", "To'piq", 'Chov']);
    let status = kind === 'suspension' ? "Diskvalifikatsiya" : kind === 'doubtful' ? 'Shubhali' : 'Jarohat';
    let out = kind !== 'doubtful';
    // O'yinga 3 soatdan kam qolganda "shubhali" holat aniqlanadi
    if (kind === 'doubtful' && hoursToKickoff < 3) {
      out = !recovers;
      status = out ? "O'ynamaydi (aniqlandi)" : "O'ynaydi (tiklandi)";
    }
    return {
      ...p,
      status,
      out,
      doubtful: kind === 'doubtful' && hoursToKickoff >= 3,
      reason: kind === 'injury' ? reason : kind === 'suspension' ? 'Sariq kartochkalar' : 'Mushak charchoq',
    };
  });
}

function weatherFor(match, hoursToKickoff) {
  const rng = createRng(`wx:${match.id}`);
  const cond = rng.pick(WEATHER_CONDITIONS);
  const temp = Math.round(rng.float(2, 33));
  return {
    condition: cond.key,
    label: cond.label,
    icon: cond.icon,
    tempC: temp,
    windKmh: Math.round(rng.float(3, 45)),
    humidity: Math.round(rng.float(30, 95)),
    precipitationMm: Number(rng.float(...cond.precip).toFixed(1)),
    // Prognoz ishonchliligi o'yin yaqinlashgan sari oshadi
    forecastConfidence: Number(Math.min(0.95, 0.55 + (72 - Math.min(72, hoursToKickoff)) / 160).toFixed(2)),
  };
}

function h2hFor(home, away) {
  const pairKey = [home.id, away.id].sort().join('-');
  const rng = createRng(`h2h:${pairKey}`);
  const games = Array.from({ length: 5 }, (_, i) => {
    const homeSide = rng.chance(0.5) ? home : away;
    const awaySide = homeSide === home ? away : home;
    const hg = rng.int(0, Math.round(1.5 + (homeSide.attack - 1) * 4));
    const ag = rng.int(0, Math.round(1.2 + (awaySide.attack - 1) * 4));
    return {
      date: `${2025 - Math.floor(i / 2)}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`,
      homeTeam: homeSide.name,
      awayTeam: awaySide.name,
      homeGoals: hg,
      awayGoals: ag,
    };
  });
  return games.sort((a, b) => b.date.localeCompare(a.date)); // eng yangisi birinchi
}

export function createMockProvider() {
  return {
    name: 'mock',

    listMatches({ from, to, now = Date.now() }) {
      return rawFixturesBetween(from, to, now).map((f) => hydrate(f, now));
    },

    getMatch(id, now = Date.now()) {
      if (id.startsWith('demo_')) {
        const slot = Number(id.slice(5));
        return Number.isFinite(slot) ? hydrate(demoFixture(slot), now) : null;
      }
      const [leagueId, key] = id.split('_');
      const league = leagueById(leagueId);
      if (!league || !/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return null;
      const fx = fixturesForDay(key, league).find((f) => f.id === id);
      return fx ? hydrate(fx, now) : null;
    },

    getContext(match, now = Date.now()) {
      const kickoff = Date.parse(match.kickoff);
      const hoursToKickoff = (kickoff - now) / HOUR;
      const seasonSeed = Math.floor(kickoff / (7 * DAY));
      const table = standingsFor(match.league.id, seasonSeed);
      const rest = (team) => {
        const last = lastMatchBefore(team.id, kickoff);
        if (last) return Math.round(((kickoff - last.kickoff) / DAY) * 10) / 10;
        return createRng(`rest:${match.id}:${team.id}`).int(4, 8);
      };
      const refRng = createRng(`ref:${match.id}`);
      return {
        hoursToKickoff: Number(hoursToKickoff.toFixed(2)),
        form: { home: formFor(match.home, match.id), away: formFor(match.away, match.id) },
        injuries: {
          home: injuriesFor(match.home, match.id, hoursToKickoff),
          away: injuriesFor(match.away, match.id, hoursToKickoff),
        },
        weather: weatherFor(match, hoursToKickoff),
        h2h: h2hFor(match.home, match.away),
        standings: {
          home: table.find((r) => r.teamId === match.home.id),
          away: table.find((r) => r.teamId === match.away.id),
          table,
        },
        restDays: { home: rest(match.home), away: rest(match.away) },
        referee: refRng.pick(REFEREES),
        derby: match.home.city === match.away.city,
        lineupsConfirmed: hoursToKickoff <= 1,
        pitch: createRng(`pitch:${match.home.id}`).pick(['Tabiiy maysa', 'Gibrid maysa', "Sun'iy maysa"]),
      };
    },
  };
}
