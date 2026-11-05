export default function Stars({ value = 0, count }) {
  const full = Math.round(value);
  return (
    <span className="stars" title={`${value} out of 5`}>
      {'★'.repeat(full)}
      <span className="stars-off">{'★'.repeat(5 - full)}</span>
      {count !== undefined && <span className="muted"> ({count})</span>}
    </span>
  );
}
