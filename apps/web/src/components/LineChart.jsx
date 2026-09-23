import { useEffect, useRef, useState } from 'react';

/** Kichik SVG chiziqli grafik: 1/X/2 ehtimollar vaqt bo'yicha. Kenglik konteynerga moslashadi. */
export default function LineChart({ points, labels, height = 160 }) {
  const ref = useRef(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  if (!points?.length) return null;
  const H = height;
  const pad = { l: 38, r: 12, t: 10, b: 24 };
  const n = points.length;
  const x = (i) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const series = ['home', 'draw', 'away'];
  // Yorliqlar bir-biriga tegmasligi uchun: har biriga ~80px joy
  const maxLabels = Math.max(2, Math.floor((W - pad.l - pad.r) / 80));
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const showLabel = (i) => (i % step === 0 && (n - 1 - i >= step || i === n - 1)) || i === n - 1;
  return (
    <div ref={ref} className="linechart-wrap">
      <svg className="linechart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ehtimollar dinamikasi">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="gridline" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="axis">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {series.map((s) => (
          <polyline key={s} className={`line ${s}`} points={points.map((p, i) => `${x(i)},${y(p[s])}`).join(' ')} />
        ))}
        {n <= 20 &&
          series.map((s) => points.map((p, i) => <circle key={`${s}${i}`} className={`pt ${s}`} cx={x(i)} cy={y(p[s])} r={3} />))}
        {labels?.map((l, i) =>
          showLabel(i) ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'} className="axis">
              {l}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
