import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, useFetch, useSSE } from '../api.js';
import { countdown, dateLong, pct, time, RESULT_LABEL } from '../format.js';
import ProbBar from '../components/ProbBar.jsx';
import LineChart from '../components/LineChart.jsx';
import StatRow from '../components/StatRow.jsx';

export default function MatchPage() {
  const { id } = useParams();
  const match = useFetch(() => api.match(id), [id]);
  const analysis = useFetch(() => api.analysis(id), [id]);
  const m = match.data;
  const started = m && m.status !== 'scheduled';
  const [tab, setTab] = useState(null);
  const activeTab = tab ?? (started ? 'live' : 'analysis');

  // O'yin boshlanmagan bo'lsa ham, boshlanish vaqtida live'ga o'tish uchun har daqiqada yangilaymiz
  useEffect(() => {
    if (!m || m.status !== 'scheduled') return undefined;
    const t = setInterval(() => {
      match.reload();
      analysis.reload();
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.status]);

  if (match.error) return <div className="page"><div className="error">{match.error.message}</div><Link to="/">← Orqaga</Link></div>;
  if (!m) return <div className="page"><div className="skeleton big" /></div>;

  return (
    <div className="page">
      <Link to="/" className="back">← O'yinlar</Link>
      <Scoreboard m={m} />

      <div className="tabs">
        <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}>📊 Tahlil</button>
        <button className={activeTab === 'factors' ? 'active' : ''} onClick={() => setTab('factors')}>🔍 Omillar</button>
        <button className={activeTab === 'context' ? 'active' : ''} onClick={() => setTab('context')}>📋 Ma'lumotlar</button>
        {started && <button className={activeTab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>🔴 Live</button>}
      </div>

      {activeTab === 'live' && started && <LivePanel m={m} />}
      {activeTab !== 'live' && (
        <>
          {analysis.loading && !analysis.data && <div className="skeleton big" />}
          {analysis.error && <div className="error">{analysis.error.message}</div>}
          {analysis.data && !analysis.data.available && <Waiting a={analysis.data} />}
          {analysis.data?.available && activeTab === 'analysis' && <AnalysisPanel m={m} a={analysis.data} />}
          {analysis.data?.available && activeTab === 'factors' && <FactorsPanel m={m} a={analysis.data} />}
          {analysis.data?.available && activeTab === 'context' && <ContextPanel m={m} a={analysis.data} />}
        </>
      )}
    </div>
  );
}

function Scoreboard({ m }) {
  const live = m.status === 'live';
  return (
    <section className="scoreboard">
      <div className="sb-league">
        {m.league.flag} {m.league.name} · {dateLong(m.kickoff)}, {time(m.kickoff)}
      </div>
      <div className="sb-main">
        <div className="sb-team">
          <div className="crest">{m.home.short}</div>
          <div className="name">{m.home.name}</div>
        </div>
        <div className="sb-center">
          {m.status === 'scheduled' ? (
            <>
              <div className="sb-vs">{time(m.kickoff)}</div>
              <div className="muted small">{countdown(m.kickoff)} qoldi</div>
            </>
          ) : (
            <>
              <div className="sb-score">
                {m.score?.home} : {m.score?.away}
              </div>
              <div className={live ? 'live-badge' : 'muted small'}>{live ? m.clock?.label : 'Tugadi'}</div>
            </>
          )}
        </div>
        <div className="sb-team">
          <div className="crest away">{m.away.short}</div>
          <div className="name">{m.away.name}</div>
        </div>
      </div>
      <div className="sb-venue muted small">🏟 {m.venue.stadium}, {m.venue.city}</div>
    </section>
  );
}

function Waiting({ a }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="card waiting-card">
      <div className="big-icon">⏳</div>
      <h3>{a.message}</h3>
      <p>
        Tahlil ochilishiga: <b>{countdown(a.opensAt)}</b>
      </p>
      <p className="muted small">
        72 soat qolganda — dastlabki tahlil, 24 soatda — asosiy tahlil, 3 soatda — yakuniy tahlil (tarkiblar va shubhali o'yinchilar aniqlanadi).
      </p>
    </div>
  );
}

const PHASES = [
  { key: 'early', label: '72 soat — Dastlabki' },
  { key: 'main', label: '24 soat — Asosiy' },
  { key: 'final', label: '3 soat — Yakuniy' },
];

function PhaseSteps({ phase }) {
  const order = { early: 1, main: 2, final: 3, closed: 4 }[phase.key] ?? 0;
  return (
    <div className="phase-steps">
      {PHASES.map((p, i) => (
        <div key={p.key} className={`step ${order > i + 1 ? 'done' : order === i + 1 ? 'current' : ''}`}>
          <span className="bullet">{i + 1}</span>
          {p.label}
        </div>
      ))}
    </div>
  );
}

function AnalysisPanel({ m, a }) {
  const timeline = useFetch(() => api.timeline(m.id), [m.id, a.phase.key]);
  const ou = a.markets.overUnder;
  const points = timeline.data?.computed ?? [];
  return (
    <div className="grid">
      <div className="card span-2">
        <div className="card-head">
          <h3>{a.phase.label}{a.frozen ? " (o'yin oldi, muzlatilgan)" : ''}</h3>
          <span className="confidence" title="Ishonch darajasi">
            Ishonch <b>{pct(a.confidence)}</b>
          </span>
        </div>
        <PhaseSteps phase={a.phase} />
        <p className="verdict">{a.verdict}</p>
        <ProbBar p={a.probabilities} homeLabel={m.home.short} awayLabel={m.away.short} />
        <div className="xg-row">
          <div>
            <span className="muted small">Kutilayotgan gollar (xG)</span>
            <div className="xg">
              <b>{a.expectedGoals.home}</b> — <b>{a.expectedGoals.away}</b>
            </div>
          </div>
          <div>
            <span className="muted small">Tarkiblar</span>
            <div>{a.lineupsConfirmed ? '✅ Tasdiqlangan' : '⏳ Hali tasdiqlanmagan'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Gollar soni</h3>
        <table className="table">
          <thead>
            <tr><th>Chiziq</th><th>Ko'p</th><th>Kam</th></tr>
          </thead>
          <tbody>
            {['1.5', '2.5', '3.5'].map((l) => (
              <tr key={l}>
                <td>{l}</td>
                <td className={ou[l].over > 0.5 ? 'hl' : ''}>{pct(ou[l].over)}</td>
                <td className={ou[l].under > 0.5 ? 'hl' : ''}>{pct(ou[l].under)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="kv"><span>Ikkala jamoa gol uradi</span><b>{pct(a.markets.btts.yes)}</b></div>
        <div className="kv"><span>Kutilayotgan sariq kartochkalar</span><b>~{a.markets.expectedYellowCards}</b></div>
      </div>

      <div className="card">
        <h3>Ehtimolli hisoblar</h3>
        <div className="scores">
          {a.markets.topScores.map((s) => (
            <div key={s.score} className="score-pill">
              <b>{s.score}</b>
              <span>{pct(s.p)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card span-2">
        <h3>Tahlil dinamikasi</h3>
        <p className="muted small">O'yin yaqinlashgan sari yangi ma'lumotlar (jarohatlar, ob-havo prognozi, tarkiblar) bilan ehtimollar qanday o'zgargani.</p>
        {points.length ? (
          <>
            <LineChart points={points.map((p) => p.probabilities)} labels={points.map((p) => `${p.hoursBefore} soat oldin`)} />
            <Legend m={m} />
          </>
        ) : (
          <div className="muted">Ma'lumot yetarli emas.</div>
        )}
      </div>
    </div>
  );
}

function Legend({ m }) {
  return (
    <div className="legend">
      <span className="home">■ {m.home.short}</span>
      <span className="draw">■ Durang</span>
      <span className="away">■ {m.away.short}</span>
    </div>
  );
}

function FactorsPanel({ m, a }) {
  const groups = a.factors.reduce((acc, f) => {
    (acc[f.group] ||= []).push(f);
    return acc;
  }, {});
  return (
    <div className="card">
      <p className="muted small">
        Chiziq chapga — <b className="c-home">{m.home.short}</b> foydasiga, o'ngga — <b className="c-away">{m.away.short}</b> foydasiga.
      </p>
      {Object.entries(groups).map(([g, list]) => (
        <div key={g} className="factor-group">
          <h4>{g}</h4>
          {list.map((f) => (
            <div key={f.key} className="factor">
              <div className="factor-head">
                <b>{f.title}</b>
                <ImpactBar v={f.impact} />
              </div>
              <p>{f.detail}</p>
              {f.goalsEffect ? <p className="muted small">Gollar soniga ta'sir: {f.goalsEffect > 0 ? '+' : ''}{Math.round(f.goalsEffect * 100)}%</p> : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ImpactBar({ v }) {
  const w = Math.min(50, Math.abs(v) * 50);
  return (
    <div className="impact" title={`Ta'sir: ${v}`}>
      <span className="mid" />
      <span className={`fill ${v >= 0 ? 'home' : 'away'}`} style={v >= 0 ? { right: '50%', width: `${w}%` } : { left: '50%', width: `${w}%` }} />
    </div>
  );
}

function FormBadges({ form }) {
  return (
    <div className="form">
      {form.map((f, i) => (
        <span key={i} className={`fb ${f.result}`} title={`${f.gf}:${f.ga} vs ${f.opponent} (xG ${f.xg})`}>
          {RESULT_LABEL[f.result]}
        </span>
      ))}
    </div>
  );
}

function ContextPanel({ m, a }) {
  const c = a.context;
  const w = c.weather;
  const injuryList = (list) =>
    list.length ? (
      <ul className="inj">
        {list.map((p) => (
          <li key={p.id} className={p.out ? 'out' : p.doubtful ? 'doubt' : 'ok'}>
            <b>{p.name}</b> <span className="muted">{p.positionLabel}</span>
            <div className="small">{p.status} · {p.reason} · ahamiyati {Math.round(p.importance * 100)}%</div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="muted">Yo'qotishlar yo'q</p>
    );
  return (
    <div className="grid">
      <div className="card">
        <h3>Forma (so'nggi 5)</h3>
        <div className="kv"><span>{m.home.name}</span><FormBadges form={c.form.home} /></div>
        <div className="kv"><span>{m.away.name}</span><FormBadges form={c.form.away} /></div>
      </div>
      <div className="card">
        <h3>Turnir jadvali</h3>
        <div className="kv"><span>{m.home.name}</span><b>{c.standings.home?.position}-o'rin · {c.standings.home?.points} ochko</b></div>
        <div className="kv"><span>{m.away.name}</span><b>{c.standings.away?.position}-o'rin · {c.standings.away?.points} ochko</b></div>
      </div>
      <div className="card">
        <h3>{m.home.name}: jarohatlar</h3>
        {injuryList(c.injuries.home)}
      </div>
      <div className="card">
        <h3>{m.away.name}: jarohatlar</h3>
        {injuryList(c.injuries.away)}
      </div>
      <div className="card">
        <h3>Ob-havo</h3>
        <div className="weather">
          <span className="big-icon">{w.icon}</span>
          <div>
            <b>{w.label}, {w.tempC}°C</b>
            <div className="small muted">Shamol {w.windKmh} km/soat · Namlik {w.humidity}% · Yog'in {w.precipitationMm} mm</div>
            <div className="small muted">Prognoz ishonchliligi {pct(w.forecastConfidence)}</div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Kichik detallar</h3>
        <div className="kv"><span>Dam olish ({m.home.short} / {m.away.short})</span><b>{c.restDays.home} / {c.restDays.away} kun</b></div>
        <div className="kv"><span>Hakam</span><b>{c.referee.name}</b></div>
        <div className="kv"><span>Hakam statistikasi</span><b>{c.referee.avgYellow} 🟨 · {c.referee.avgRed} 🟥 · {c.referee.penaltiesPerGame} pen.</b></div>
        <div className="kv"><span>Maydon</span><b>{c.pitch}</b></div>
        <div className="kv"><span>Derbi</span><b>{c.derby ? 'Ha' : "Yo'q"}</b></div>
      </div>
      <div className="card span-2">
        <h3>Shaxsiy uchrashuvlar</h3>
        <table className="table">
          <tbody>
            {c.h2h.map((g, i) => (
              <tr key={i}>
                <td className="muted">{g.date}</td>
                <td className="right">{g.homeTeam}</td>
                <td className="center"><b>{g.homeGoals}:{g.awayGoals}</b></td>
                <td>{g.awayTeam}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EVENT_ICON = { goal: '⚽', yellow: '🟨', red: '🟥', sub: '🔁' };

function LivePanel({ m }) {
  const { data: live, connected } = useSSE(`/api/matches/${m.id}/live/stream`);
  if (!live) return <div className="skeleton big" />;
  const s = live.stats;
  return (
    <div className="grid">
      <div className="card span-2">
        <div className="card-head">
          <h3>
            {m.home.name} <span className="live-score">{live.score.home}:{live.score.away}</span> {m.away.name}
          </h3>
          <span className={`conn ${connected ? 'on' : 'off'}`}>{live.status === 'finished' ? 'Tugadi' : live.clock.label}</span>
        </div>
        {live.status === 'live' && live.probabilities && (
          <>
            <p className="muted small">Hozirgi holatga ko'ra yakuniy natija ehtimollari (o'yin oldi: {pct(live.preMatch.home)} / {pct(live.preMatch.draw)} / {pct(live.preMatch.away)})</p>
            <ProbBar p={live.probabilities} homeLabel={m.home.short} awayLabel={m.away.short} />
          </>
        )}
      </div>

      {s && (
        <div className="card">
          <h3>Statistika</h3>
          <StatRow label="To'p nazorati" home={s.possession.home} away={s.possession.away} suffix="%" />
          <StatRow label="Zarbalar" home={s.home.shots} away={s.away.shots} />
          <StatRow label="Darvozaga" home={s.home.onTarget} away={s.away.onTarget} />
          <StatRow label="xG" home={s.home.xg} away={s.away.xg} />
          <StatRow label="Burchaklar" home={s.home.corners} away={s.away.corners} />
          <StatRow label="Qoidabuzarliklar" home={s.home.fouls} away={s.away.fouls} />
          <StatRow label="Sariq" home={s.home.yellow} away={s.away.yellow} />
        </div>
      )}

      <div className="card">
        <h3>Hodisalar</h3>
        {!live.events.length && <p className="muted">Hozircha hodisa yo'q</p>}
        <ul className="events">
          {[...live.events].reverse().map((e, i) => (
            <li key={i} className={`ev ${e.side} ${e.type}`}>
              <span className="min">{e.minute}</span>
              <span>{EVENT_ICON[e.type]}</span>
              <span>
                <b>{e.side === 'home' ? m.home.short : m.away.short}</b> {e.detail}
                {e.score ? <b> ({e.score})</b> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {live.momentum?.length > 1 && (
        <div className="card span-2">
          <h3>O'yin davomida ehtimollar</h3>
          <LineChart points={live.momentum} labels={live.momentum.map((p) => p.minute)} />
          <Legend m={m} />
        </div>
      )}
    </div>
  );
}
