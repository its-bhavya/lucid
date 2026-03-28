const BETTER_IS_LOWER = ["P/E"];
const BETTER_IS_HIGHER = ["Growth", "Margin", "Dividend"];

function parseNumeric(val) {
  if (val == null) return null;
  const s = String(val).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function cellHighlight(metric, v1, v2) {
  const n1 = parseNumeric(v1);
  const n2 = parseNumeric(v2);
  if (n1 == null || n2 == null || n1 === n2) return [null, null];

  const lowerBetter = BETTER_IS_LOWER.some((m) => metric.includes(m));
  const higherBetter = BETTER_IS_HIGHER.some((m) => metric.includes(m));

  if (lowerBetter) {
    return n1 < n2 ? ["text-accent-green", null] : [null, "text-accent-green"];
  }
  if (higherBetter) {
    return n1 > n2 ? ["text-accent-green", null] : [null, "text-accent-green"];
  }
  // Debt — lower is better
  if (metric.toLowerCase().includes("debt")) {
    return n1 < n2 ? ["text-accent-green", null] : [null, "text-accent-green"];
  }
  return [null, null];
}

export default function CompareView({ stock1, stock2, comparison, onBack }) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Watchlist
        </button>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-6">
          <div className="text-center flex-1">
            <p className="text-xl font-bold text-white">{stock1.name}</p>
            <p className="text-sm font-medium text-accent">{stock1.ticker}</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {stock1.price != null ? `$${Number(stock1.price).toFixed(2)}` : "N/A"}
            </p>
          </div>

          <div className="mx-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
            <span className="text-sm font-bold text-text-muted">vs</span>
          </div>

          <div className="text-center flex-1">
            <p className="text-xl font-bold text-white">{stock2.name}</p>
            <p className="text-sm font-medium text-accent">{stock2.ticker}</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {stock2.price != null ? `$${Number(stock2.price).toFixed(2)}` : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Side by Side
        </h3>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Metric
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {stock1.ticker}
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {stock2.ticker}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.table?.map((row, i) => {
                const [h1, h2] = cellHighlight(row.metric, row.stock1_value, row.stock2_value);
                return (
                  <tr
                    key={i}
                    className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "bg-card" : "bg-surface"}`}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-text-primary">
                      {row.metric}
                    </td>
                    <td className={`px-5 py-3 text-right text-sm font-medium ${h1 || "text-text-primary"}`}>
                      {row.stock1_value ?? "N/A"}
                    </td>
                    <td className={`px-5 py-3 text-right text-sm font-medium ${h2 || "text-text-primary"}`}>
                      {row.stock2_value ?? "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Verdict */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Verdict
        </h3>
        <p className="rounded-xl bg-card p-5 text-sm leading-relaxed text-text-primary">
          {comparison.verdict}
        </p>
      </section>

      {/* Pick cards */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-accent-green/30 bg-accent-green/5 p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-green">
              If you want growth
            </p>
            <p className="text-lg font-bold text-white">
              Choose {comparison.pick_if_growth}
            </p>
          </div>
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">
              If you want stability
            </p>
            <p className="text-lg font-bold text-white">
              Choose {comparison.pick_if_stability}
            </p>
          </div>
        </div>
      </section>

      {/* Back button */}
      <div className="flex justify-center">
        <button
          onClick={onBack}
          className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Back to Watchlist
        </button>
      </div>
    </div>
  );
}
