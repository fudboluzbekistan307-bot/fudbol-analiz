// O'yin oldi tahlil dvigateli.
// Har bir omil (forma, jarohatlar, ob-havo, dam olish, H2H, motivatsiya, derbi, hakam...)
// jamoalarning kutilayotgan gollariga (xG, Puasson λ) ta'sir qiladi, so'ng
// Puasson taqsimoti (Dixon–Coles tuzatmasi bilan) orqali ehtimollar hisoblanadi.

export const ANALYSIS_WINDOW_HOURS = 72; // tahlil o'yindan 3 kun oldin boshlanadi

const BASE_HOME_GOALS = 1.5;
const BASE_AWAY_GOALS = 1.15;
const MAX_GOALS = 10;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v, d = 2) => Number(v.toFixed(d));

export function phaseFor(hoursToKickoff) {
  if (hoursToKickoff > ANALYSIS_WINDOW_HOURS) return { key: 'waiting', label: 'Kutilmoqda', order: 0 };
  if (hoursToKickoff > 24) return { key: 'early', label: 'Dastlabki tahlil', order: 1 };
  if (hoursToKickoff > 3) return { key: 'main', label: 'Asosiy tahlil', order: 2 };
  if (hoursToKickoff > 0) return { key: 'final', label: 'Yakuniy tahlil', order: 3 };
  return { key: 'closed', label: "O'yin boshlangan", order: 4 };
}

function poisson(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// Dixon–Coles: past hisoblar (0:0, 1:0, 0:1, 1:1) uchun tuzatma
function dcTau(h, a, lh, la, rho) {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

/** Hisoblar matritsasi va undan kelib chiqadigan bozorlar. offsetHome/Away — live paytda hozirgi hisob. */
export function scoreMatrix(lambdaHome, lambdaAway, { rho = -0.08, offsetHome = 0, offsetAway = 0 } = {}) {
  const cells = [];
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poisson(h, lambdaHome) * poisson(a, lambdaAway) * dcTau(h, a, lambdaHome, lambdaAway, rho);
      cells.push({ h: h + offsetHome, a: a + offsetAway, p: Math.max(0, p) });
      total += Math.max(0, p);
    }
  }
  for (const c of cells) c.p /= total;

  const sum = (fn) => cells.reduce((s, c) => (fn(c) ? s + c.p : s), 0);
  const overUnder = {};
  for (const line of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    const over = sum((c) => c.h + c.a > line);
    overUnder[line] = { over: round(over, 4), under: round(1 - over, 4) };
  }
  return {
    homeWin: round(sum((c) => c.h > c.a), 4),
    draw: round(sum((c) => c.h === c.a), 4),
    awayWin: round(sum((c) => c.h < c.a), 4),
    btts: round(sum((c) => c.h > 0 && c.a > 0), 4),
    overUnder,
    topScores: [...cells]
      .sort((x, y) => y.p - x.p)
      .slice(0, 6)
      .map((c) => ({ score: `${c.h}:${c.a}`, p: round(c.p, 4) })),
  };
}

const formPoints = (form) => form.reduce((s, f) => s + (f.result === 'W' ? 3 : f.result === 'D' ? 1 : 0), 0);
const weightedForm = (form) =>
  // Oxirgi o'yinlar muhimroq: 1.0, 0.9, 0.8, 0.7, 0.6
  form.reduce((s, f, i) => s + (f.result === 'W' ? 3 : f.result === 'D' ? 1 : 0) * (1 - i * 0.1), 0) / 4.0;

/**
 * Asosiy funksiya: o'yin + kontekst -> to'liq tahlil.
 * @param {object} match
 * @param {object} ctx — provider.getContext() natijasi
 */
export function analyzeMatch(match, ctx, now = Date.now()) {
  const hoursToKickoff = (Date.parse(match.kickoff) - now) / 3600_000;
  const phase = phaseFor(hoursToKickoff);
  if (phase.key === 'waiting') {
    return {
      matchId: match.id,
      available: false,
      phase,
      opensAt: new Date(Date.parse(match.kickoff) - ANALYSIS_WINDOW_HOURS * 3600_000).toISOString(),
      message: "Tahlil o'yindan 72 soat (3 kun) oldin ochiladi.",
    };
  }

  const { home, away } = match;
  const factors = [];
  // effHome/effAway — reyting (Elo) ga qo'shiladigan tuzatmalar
  let effHome = home.rating + 65; // uy maydoni ustunligi ~65 Elo
  let effAway = away.rating;
  let goalsMult = 1; // umumiy gollar soniga ta'sir (ob-havo, derbi...)
  const addFactor = (f) => factors.push({ ...f, impact: round(f.impact, 3) });

  addFactor({
    key: 'home_advantage',
    group: 'Asosiy',
    title: 'Uy maydoni',
    detail: `${home.name} o'z maydonida (${match.venue.stadium}) o'ynaydi.`,
    impact: 0.15,
  });

  // 1) Reyting farqi
  const ratingDiff = home.rating - away.rating;
  addFactor({
    key: 'rating',
    group: 'Asosiy',
    title: 'Jamoalar kuchi (reyting)',
    detail: `${home.name}: ${home.rating}, ${away.name}: ${away.rating} (farq ${ratingDiff > 0 ? '+' : ''}${ratingDiff}).`,
    impact: clamp(ratingDiff / 300, -1, 1),
  });

  // 2) Forma (oxirgi 5 o'yin, yangilari og'irroq)
  const fh = weightedForm(ctx.form.home);
  const fa = weightedForm(ctx.form.away);
  effHome += (fh - 1.4) * 22;
  effAway += (fa - 1.4) * 22;
  addFactor({
    key: 'form',
    group: 'Forma',
    title: "So'nggi 5 o'yin formasi",
    detail: `${home.short}: ${ctx.form.home.map((f) => f.result).join('')} (${formPoints(ctx.form.home)} ochko), ${away.short}: ${ctx.form.away.map((f) => f.result).join('')} (${formPoints(ctx.form.away)} ochko).`,
    impact: clamp((fh - fa) / 3, -1, 1),
  });

  // 3) xG formasi — natijadan ko'ra barqarorroq ko'rsatkich
  const avgXg = (form) => form.reduce((s, f) => s + f.xg, 0) / form.length;
  const xgH = avgXg(ctx.form.home);
  const xgA = avgXg(ctx.form.away);
  addFactor({
    key: 'xg_form',
    group: 'Forma',
    title: "O'rtacha xG (so'nggi 5)",
    detail: `${home.short} ${xgH.toFixed(2)} xG, ${away.short} ${xgA.toFixed(2)} xG o'yin boshiga.`,
    impact: clamp((xgH - xgA) / 2, -1, 1),
  });

  // 4) Jarohatlar va diskvalifikatsiyalar — o'yinchi ahamiyati bo'yicha
  const injuryLoss = (list) =>
    list.reduce((s, p) => s + (p.out ? p.importance : p.doubtful ? p.importance * 0.5 : 0), 0);
  const lossH = injuryLoss(ctx.injuries.home);
  const lossA = injuryLoss(ctx.injuries.away);
  effHome -= lossH * 38;
  effAway -= lossA * 38;
  const attackLoss = (list) =>
    list.filter((p) => p.position === 'FW' || p.position === 'MF').reduce((s, p) => s + (p.out ? p.importance : p.doubtful ? p.importance * 0.5 : 0), 0);
  const defenceLoss = (list) =>
    list.filter((p) => p.position === 'DF' || p.position === 'GK').reduce((s, p) => s + (p.out ? p.importance : p.doubtful ? p.importance * 0.5 : 0), 0);
  const describeInj = (list) =>
    list.length ? list.map((p) => `${p.name} (${p.positionLabel.toLowerCase()}, ${p.status.toLowerCase()})`).join(', ') : "yo'q";
  addFactor({
    key: 'injuries',
    group: 'Tarkib',
    title: 'Jarohatlar va diskvalifikatsiyalar',
    detail: `${home.short}: ${describeInj(ctx.injuries.home)}. ${away.short}: ${describeInj(ctx.injuries.away)}.`,
    impact: clamp((lossA - lossH) / 1.5, -1, 1),
  });

  // 5) Dam olish kunlari (charchoq)
  const fatigue = (days) => (days < 3 ? (3 - days) * 18 : 0);
  effHome -= fatigue(ctx.restDays.home);
  effAway -= fatigue(ctx.restDays.away);
  addFactor({
    key: 'rest',
    group: 'Kichik detallar',
    title: 'Dam olish kunlari',
    detail: `${home.short}: ${ctx.restDays.home} kun, ${away.short}: ${ctx.restDays.away} kun. 3 kundan kam dam — charchoq xavfi.`,
    impact: clamp((fatigue(ctx.restDays.away) - fatigue(ctx.restDays.home)) / 40, -1, 1),
  });

  // 6) Ob-havo
  const w = ctx.weather;
  let wxMult = 1;
  const wxNotes = [];
  if (w.condition === 'heavy_rain') { wxMult *= 0.9; wxNotes.push("kuchli yomg'ir to'p nazoratini qiyinlashtiradi"); }
  else if (w.condition === 'rain') { wxMult *= 0.96; wxNotes.push("yomg'ir — sirpanchiq maydon"); }
  if (w.condition === 'fog') { wxMult *= 0.97; wxNotes.push("tuman — uzun paslar qiyinlashadi"); }
  if (w.windKmh > 35) { wxMult *= 0.94; wxNotes.push(`kuchli shamol (${w.windKmh} km/soat)`); }
  if (w.tempC >= 30) { wxMult *= 0.95; wxNotes.push(`issiq (${w.tempC}°C) — temp pasayadi`); }
  if (w.tempC <= 3) { wxMult *= 0.97; wxNotes.push(`sovuq (${w.tempC}°C)`); }
  // Kuchli texnik jamoa yomon ob-havoda ustunligini biroz yo'qotadi
  const wxEqualizer = wxMult < 0.97 ? 0.85 : 1;
  goalsMult *= wxMult;
  addFactor({
    key: 'weather',
    group: 'Kichik detallar',
    title: 'Ob-havo',
    detail: `${w.icon} ${w.label}, ${w.tempC}°C, shamol ${w.windKmh} km/soat, namlik ${w.humidity}%. ${wxNotes.length ? wxNotes.join('; ') + '.' : "O'yinga sezilarli ta'sir yo'q."} Prognoz ishonchliligi ${Math.round(w.forecastConfidence * 100)}%.`,
    impact: 0,
    goalsEffect: round(wxMult - 1, 3),
  });

  // 7) Motivatsiya (turnir jadvali)
  const sh = ctx.standings.home;
  const sa = ctx.standings.away;
  const motivation = (row) => {
    if (!row) return { v: 0, note: '' };
    if (row.position <= 2) return { v: 12, note: 'chempionlik uchun kurash' };
    if (row.position <= 4) return { v: 8, note: "yevrokubok/top-4 uchun kurash" };
    if (row.position >= row.total - 1) return { v: 14, note: "quyi zonadan chiqish uchun kurash" };
    return { v: 0, note: "o'rta zona" };
  };
  const mh = motivation(sh);
  const ma = motivation(sa);
  effHome += mh.v;
  effAway += ma.v;
  addFactor({
    key: 'motivation',
    group: 'Kichik detallar',
    title: 'Turnir jadvali va motivatsiya',
    detail: `${home.short}: ${sh?.position}-o'rin, ${sh?.points} ochko (${mh.note}). ${away.short}: ${sa?.position}-o'rin, ${sa?.points} ochko (${ma.note}).`,
    impact: clamp((mh.v - ma.v) / 30, -1, 1),
  });

  // 8) Shaxsiy uchrashuvlar (H2H)
  let h2hHome = 0, h2hAway = 0, h2hDraw = 0, h2hGoals = 0;
  for (const g of ctx.h2h) {
    h2hGoals += g.homeGoals + g.awayGoals;
    const winner = g.homeGoals > g.awayGoals ? g.homeTeam : g.homeGoals < g.awayGoals ? g.awayTeam : null;
    if (!winner) h2hDraw++;
    else if (winner === home.name) h2hHome++;
    else h2hAway++;
  }
  const h2hAvgGoals = h2hGoals / Math.max(1, ctx.h2h.length);
  effHome += (h2hHome - h2hAway) * 4;
  addFactor({
    key: 'h2h',
    group: 'Tarix',
    title: 'Shaxsiy uchrashuvlar (oxirgi 5)',
    detail: `${home.short} ${h2hHome} g'alaba, ${h2hDraw} durang, ${away.short} ${h2hAway} g'alaba. O'rtacha ${h2hAvgGoals.toFixed(1)} gol.`,
    impact: clamp((h2hHome - h2hAway) / 10, -1, 1),
  });

  // 9) Derbi
  if (ctx.derby) {
    goalsMult *= 0.95;
    addFactor({
      key: 'derby',
      group: 'Kichik detallar',
      title: 'Shahar derbisi',
      detail: `Ikkala jamoa ham ${home.city}dan — derbilarda keskinlik yuqori, uy ustunligi pasayadi, kartochkalar ko'payadi.`,
      impact: -0.05,
    });
    effHome -= 25;
  }

  // 10) Hakam
  const ref = ctx.referee;
  addFactor({
    key: 'referee',
    group: 'Kichik detallar',
    title: 'Hakam',
    detail: `${ref.name}: o'yin boshiga ${ref.avgYellow} sariq, ${ref.avgRed} qizil, ${ref.penaltiesPerGame} penalti.`,
    impact: 0,
  });

  // 11) Maydon qoplamasi
  addFactor({
    key: 'pitch',
    group: 'Kichik detallar',
    title: 'Maydon',
    detail: `${ctx.pitch}${ctx.pitch === "Sun'iy maysa" ? " — mehmon jamoa uchun noqulay bo'lishi mumkin." : '.'}`,
    impact: ctx.pitch === "Sun'iy maysa" ? 0.05 : 0,
  });
  if (ctx.pitch === "Sun'iy maysa") effHome += 10;

  // --- Kutilayotgan gollar (λ) ---
  // Yomon ob-havoda kuch farqi biroz tenglashadi (uy ustunligi o'zgarmaydi)
  const diff = (effHome - effAway - 65) * wxEqualizer + 65;
  const strength = Math.exp(diff / 900);
  let lambdaHome = BASE_HOME_GOALS * (home.attack / away.defense) ** 0.5 * strength ** 0.5;
  let lambdaAway = BASE_AWAY_GOALS * (away.attack / home.defense) ** 0.5 / strength ** 0.5;
  // Hujumchilar yo'qligi o'z golini kamaytiradi, raqib himoyachilari yo'qligi — ko'paytiradi
  lambdaHome *= 1 + defenceLossFactor(defenceLoss(ctx.injuries.away)) - attackLossFactor(attackLoss(ctx.injuries.home));
  lambdaAway *= 1 + defenceLossFactor(defenceLoss(ctx.injuries.home)) - attackLossFactor(attackLoss(ctx.injuries.away));
  // Liga va H2H gollilik darajasiga yengil moslashtirish (10%)
  const blend = 0.9 + 0.1 * clamp(h2hAvgGoals / 2.65, 0.6, 1.4);
  lambdaHome = clamp(lambdaHome * goalsMult * blend, 0.15, 4.5);
  lambdaAway = clamp(lambdaAway * goalsMult * blend, 0.1, 4);

  const markets = scoreMatrix(lambdaHome, lambdaAway);

  // Kartochkalar prognozi
  const expectedYellow = round(ref.avgYellow * (ctx.derby ? 1.2 : 1) * (Math.abs(home.rating - away.rating) < 60 ? 1.08 : 1), 1);

  // Ishonch darajasi: bosqich (ma'lumot to'liqligi) + natija aniqligi
  const phaseConf = { early: 0.55, main: 0.72, final: 0.85, closed: 0.85 }[phase.key];
  const doubtCount = [...ctx.injuries.home, ...ctx.injuries.away].filter((p) => p.doubtful).length;
  const maxP = Math.max(markets.homeWin, markets.draw, markets.awayWin);
  const confidence = round(clamp(phaseConf * (ctx.lineupsConfirmed ? 1.05 : 1) * w.forecastConfidence ** 0.2 - doubtCount * 0.03 + (maxP - 0.4) * 0.3, 0.2, 0.95));

  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    matchId: match.id,
    available: true,
    generatedAt: new Date(now).toISOString(),
    phase,
    hoursToKickoff: round(hoursToKickoff, 1),
    expectedGoals: { home: round(lambdaHome), away: round(lambdaAway) },
    probabilities: { home: markets.homeWin, draw: markets.draw, away: markets.awayWin },
    markets: {
      overUnder: markets.overUnder,
      btts: { yes: markets.btts, no: round(1 - markets.btts, 4) },
      topScores: markets.topScores,
      expectedYellowCards: expectedYellow,
    },
    confidence,
    lineupsConfirmed: ctx.lineupsConfirmed,
    factors,
    verdict: buildVerdict(match, markets, lambdaHome, lambdaAway, confidence),
    context: {
      form: ctx.form,
      injuries: ctx.injuries,
      weather: ctx.weather,
      h2h: ctx.h2h,
      standings: { home: ctx.standings.home, away: ctx.standings.away },
      restDays: ctx.restDays,
      referee: ctx.referee,
      derby: ctx.derby,
      pitch: ctx.pitch,
    },
  };
}

function attackLossFactor(loss) {
  return clamp(loss * 0.07, 0, 0.18);
}
function defenceLossFactor(loss) {
  return clamp(loss * 0.06, 0, 0.15);
}

function buildVerdict(match, m, lh, la, confidence) {
  const { home, away } = match;
  const pct = (p) => `${Math.round(p * 100)}%`;
  let main;
  if (m.homeWin > 0.5) main = `${home.name} favorit (${pct(m.homeWin)}).`;
  else if (m.awayWin > 0.45) main = `${away.name} favorit (${pct(m.awayWin)}).`;
  else if (Math.abs(m.homeWin - m.awayWin) < 0.08) main = `Teng kuchli o'yin: ${pct(m.homeWin)} / ${pct(m.draw)} / ${pct(m.awayWin)}.`;
  else main = `${m.homeWin > m.awayWin ? home.name : away.name} biroz ustun (${pct(Math.max(m.homeWin, m.awayWin))}).`;

  const total = lh + la;
  const goals = total > 2.9 ? `Ko'p gollik o'yin kutilmoqda (xG jami ${total.toFixed(2)}).` : total < 2.2 ? `Kam gollik o'yin kutilmoqda (xG jami ${total.toFixed(2)}).` : `O'rtacha gollik (xG jami ${total.toFixed(2)}).`;
  const conf = confidence >= 0.75 ? 'yuqori' : confidence >= 0.55 ? "o'rta" : 'past';
  return `${main} ${goals} Eng ehtimolli hisob — ${m.topScores[0].score}. Ishonch: ${conf}.`;
}
