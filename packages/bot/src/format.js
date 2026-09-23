// Telegram xabarlari uchun formatlash (HTML parse_mode).

export const TZ = process.env.BOT_TIMEZONE || 'Asia/Tashkent';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const pct = (p) => `${Math.round((p ?? 0) * 100)}%`;

export function time(iso) {
  return new Intl.DateTimeFormat('uz-UZ', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}
export function date(iso) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(new Date(iso));
}

export function matchLine(m) {
  const flag = m.league.flag;
  if (m.status === 'live') return `🔴 ${m.clock?.label ?? ''} ${esc(m.home.name)} ${m.score.home}:${m.score.away} ${esc(m.away.name)}`;
  if (m.status === 'finished') return `✅ ${esc(m.home.name)} ${m.score?.home ?? ''}:${m.score?.away ?? ''} ${esc(m.away.name)}`;
  return `${flag} ${time(m.kickoff)} ${esc(m.home.name)} — ${esc(m.away.name)}`;
}

export function buttonLabel(m) {
  if (m.status === 'live') return `🔴 ${m.home.short} ${m.score.home}:${m.score.away} ${m.away.short} (${m.clock?.label ?? ''})`;
  if (m.status === 'finished') return `✅ ${m.home.short} ${m.score?.home}:${m.score?.away} ${m.away.short}`;
  return `${m.league.flag} ${time(m.kickoff)} ${m.home.name} — ${m.away.name}`;
}

const bar = (p) => {
  const n = Math.round((p ?? 0) * 10);
  return '▰'.repeat(n) + '▱'.repeat(10 - n);
};

export function matchCard(m, a) {
  const lines = [
    `${m.league.flag} <b>${esc(m.league.name)}</b>`,
    `<b>${esc(m.home.name)} — ${esc(m.away.name)}</b>`,
    `🗓 ${date(m.kickoff)} ${time(m.kickoff)} · 🏟 ${esc(m.venue.stadium)}`,
    '',
  ];
  if (!a?.available) {
    lines.push(`⏳ ${esc(a?.message ?? 'Tahlil hali tayyor emas.')}`);
    if (a?.opensAt) lines.push(`Ochilish vaqti: ${date(a.opensAt)} ${time(a.opensAt)}`);
    return lines.join('\n');
  }
  const p = a.probabilities;
  lines.push(
    `📊 <b>${esc(a.phase.label)}</b>${a.frozen ? ' (o\'yin oldi)' : ''} · ishonch ${pct(a.confidence)}`,
    `1️⃣ ${esc(m.home.short)} ${bar(p.home)} ${pct(p.home)}`,
    `✖️ Durang ${bar(p.draw)} ${pct(p.draw)}`,
    `2️⃣ ${esc(m.away.short)} ${bar(p.away)} ${pct(p.away)}`,
    '',
    `⚽ xG: ${a.expectedGoals.home} — ${a.expectedGoals.away}`,
    `📈 2.5 dan ko'p: ${pct(a.markets.overUnder['2.5'].over)} · Ikkala jamoa gol: ${pct(a.markets.btts.yes)}`,
    `🎯 Ehtimolli hisoblar: ${a.markets.topScores.slice(0, 3).map((s) => `${s.score} (${pct(s.p)})`).join(', ')}`,
    `🟨 Kutilayotgan sariq kartochkalar: ~${a.markets.expectedYellowCards}`,
    '',
    `💬 ${esc(a.verdict)}`,
  );
  return lines.join('\n');
}

export function factorsText(m, a) {
  if (!a?.available) return matchCard(m, a);
  const icon = (i) => (i > 0.05 ? '🟢' : i < -0.05 ? '🔴' : '⚪️');
  const lines = [`<b>${esc(m.home.name)} — ${esc(m.away.name)}</b>`, `Omillar (🟢 ${esc(m.home.short)} foydasiga, 🔴 ${esc(m.away.short)} foydasiga):`, ''];
  for (const f of a.factors) lines.push(`${icon(f.impact)} <b>${esc(f.title)}</b>\n${esc(f.detail)}`, '');
  return lines.join('\n').slice(0, 4000);
}

export function liveText(m, live) {
  const icons = { goal: '⚽', yellow: '🟨', red: '🟥', sub: '🔁' };
  const lines = [
    `🔴 <b>${esc(m.home.name)} ${live.score.home}:${live.score.away} ${esc(m.away.name)}</b> · ${esc(live.clock.label)}`,
  ];
  if (live.stats) {
    const s = live.stats;
    lines.push(
      '',
      `To'p nazorati: ${s.possession.home}% — ${s.possession.away}%`,
      `Zarbalar (darvozaga): ${s.home.shots} (${s.home.onTarget}) — ${s.away.shots} (${s.away.onTarget})`,
      `xG: ${s.home.xg} — ${s.away.xg}`,
      `Burchaklar: ${s.home.corners} — ${s.away.corners}`,
    );
  }
  if (live.probabilities && live.status === 'live') {
    const p = live.probabilities;
    lines.push('', `📊 Hozirgi ehtimollar: ${pct(p.home)} / ${pct(p.draw)} / ${pct(p.away)}`);
  }
  const ev = live.events.filter((e) => e.type !== 'sub').slice(-8);
  if (ev.length) {
    lines.push('', ...ev.map((e) => `${icons[e.type]} ${e.minute} ${e.side === 'home' ? esc(m.home.short) : esc(m.away.short)}${e.score ? ` (${e.score})` : ''} — ${esc(e.detail)}`));
  }
  return lines.join('\n');
}
