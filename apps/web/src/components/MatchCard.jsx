import { Link } from 'react-router-dom';
import { time } from '../format.js';
import ProbBar from './ProbBar.jsx';

export default function MatchCard({ m }) {
  const live = m.status === 'live';
  const done = m.status === 'finished';
  return (
    <Link to={`/match/${m.id}`} className={`match-card ${live ? 'is-live' : ''}`}>
      <div className="mc-time">
        {live ? <span className="live-badge">{m.clock?.label}</span> : done ? <span className="muted">Tugadi</span> : time(m.kickoff)}
      </div>
      <div className="mc-teams">
        <div className="mc-team">
          <span>{m.home.name}</span>
          {(live || done) && <b>{m.score?.home}</b>}
        </div>
        <div className="mc-team">
          <span>{m.away.name}</span>
          {(live || done) && <b>{m.score?.away}</b>}
        </div>
      </div>
      <div className="mc-side">
        {m.probabilities ? (
          <ProbBar p={m.probabilities} compact />
        ) : (
          <span className="phase-chip waiting">Tahlil 3 kun oldin</span>
        )}
        {m.status === 'scheduled' && m.phase && m.phase.key !== 'waiting' && <span className={`phase-chip ${m.phase.key}`}>{m.phase.label}</span>}
      </div>
    </Link>
  );
}
