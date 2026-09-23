import { useSSE } from '../api.js';
import MatchCard from '../components/MatchCard.jsx';

export default function LivePage() {
  const { data, connected } = useSSE('/api/live/stream');
  return (
    <div className="page">
      <div className="page-head">
        <h1>Live o'yinlar</h1>
        <span className={`conn ${connected ? 'on' : 'off'}`}>{connected ? 'Jonli ulanish' : 'Ulanmoqda...'}</span>
      </div>
      {!data && <div className="skeleton-list"><div className="skeleton" /><div className="skeleton" /></div>}
      {data && !data.length && <div className="empty">Hozir live o'yin yo'q.</div>}
      <div className="match-list">
        {(data || []).map((m) => (
          <MatchCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
