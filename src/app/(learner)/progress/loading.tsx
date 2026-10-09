export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
