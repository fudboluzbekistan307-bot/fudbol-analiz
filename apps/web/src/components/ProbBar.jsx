import { pct } from '../format.js';

/** 1 / X / 2 ehtimollar chizig'i */
export default function ProbBar({ p, homeLabel = '1', awayLabel = '2', compact = false }) {
  if (!p) return null;
  return (
    <div className={`probbar ${compact ? 'compact' : ''}`}>
      <div className="probbar-track">
        <span className="seg home" style={{ flexBasis: pct(p.home) }} />
        <span className="seg draw" style={{ flexBasis: pct(p.draw) }} />
        <span className="seg away" style={{ flexBasis: pct(p.away) }} />
      </div>
      <div className="probbar-labels">
        <span className="home">{homeLabel} {pct(p.home)}</span>
        <span className="draw">X {pct(p.draw)}</span>
        <span className="away">{awayLabel} {pct(p.away)}</span>
      </div>
    </div>
  );
}
