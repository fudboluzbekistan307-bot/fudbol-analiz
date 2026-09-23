import { useMemo, useState } from 'react';
import { api, useFetch } from '../api.js';
import MatchCard from '../components/MatchCard.jsx';
import { dateShort } from '../format.js';

const DAY_LABELS = { '-1': 'Kecha', 0: 'Bugun', 1: 'Ertaga' };

function dayBounds(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const from = d.toISOString();
  d.setDate(d.getDate() + 1);
  return { from, to: new Date(d.getTime() - 1).toISOString() };
}

function dayLabel(offset) {
  if (DAY_LABELS[offset]) return DAY_LABELS[offset];
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateShort(d);
}

export default function Home() {
  const [offset, setOffset] = useState(0);
  const [league, setLeague] = useState('all');
  const { from, to } = useMemo(() => dayBounds(offset), [offset]);
  const { data, error, loading, reload } = useFetch(() => api.matches(from, to), [from, to]);
  const leagues = useFetch(() => api.leagues(), []);

  const groups = useMemo(() => {
    const list = (data || []).filter((m) => league === 'all' || m.league.id === league);
    const map = new Map();
    for (const m of list) {
      if (!map.has(m.league.id)) map.set(m.league.id, { league: m.league, matches: [] });
      map.get(m.league.id).matches.push(m);
    }
    return [...map.values()];
  }, [data, league]);

  return (
    <div className="page">
      <section className="hero">
        <h1>O'yin oldi chuqur tahlil</h1>
        <p>
          Tahlil o'yindan <b>3 kun oldin</b> boshlanadi va har bosqichda yangilanadi: forma, xG, jarohatlar, ob-havo,
          dam olish kunlari, hakam, motivatsiya, derbi va maydon — hammasi hisobga olinadi.
        </p>
      </section>

      <div className="tabs" role="tablist">
        {[-1, 0, 1, 2, 3, 4, 5, 6].map((o) => (
          <button key={o} role="tab" aria-selected={o === offset} className={o === offset ? 'active' : ''} onClick={() => setOffset(o)}>
            {dayLabel(o)}
          </button>
        ))}
      </div>

      <div className="chips">
        <button className={league === 'all' ? 'active' : ''} onClick={() => setLeague('all')}>Barchasi</button>
        {(leagues.data || []).map((l) => (
          <button key={l.id} className={league === l.id ? 'active' : ''} onClick={() => setLeague(l.id)}>
            {l.flag} {l.name}
          </button>
        ))}
      </div>

      {loading && !data && <div className="skeleton-list">{Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton" />)}</div>}
      {error && (
        <div className="error">
          {error.message} <button onClick={reload}>Qayta urinish</button>
        </div>
      )}
      {data && !groups.length && <div className="empty">Bu kunda o'yinlar yo'q.</div>}

      {groups.map((g) => (
        <section key={g.league.id} className="league-group">
          <h2>
            <span>{g.league.flag}</span> {g.league.name} <small>{g.league.country}</small>
          </h2>
          <div className="match-list">
            {g.matches.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
