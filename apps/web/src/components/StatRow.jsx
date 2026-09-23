/** Ikki tomonlama statistika qatori (live) */
export default function StatRow({ label, home, away, suffix = '' }) {
  const total = Number(home) + Number(away);
  const hp = total ? (Number(home) / total) * 100 : 50;
  return (
    <div className="statrow">
      <div className="statrow-vals">
        <b>{home}{suffix}</b>
        <span>{label}</span>
        <b>{away}{suffix}</b>
      </div>
      <div className="statrow-bar">
        <span className="home" style={{ width: `${hp}%` }} />
        <span className="away" style={{ width: `${100 - hp}%` }} />
      </div>
    </div>
  );
}
