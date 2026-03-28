import FinanceTerm from "./FinanceTerm";

const VERDICT_STYLES = {
  UNDERVALUED: "bg-green/10 text-green border-green/20",
  "FAIR VALUATION": "bg-yellow/10 text-yellow border-yellow/20",
  "EXPENSIVE BUT GROWING": "bg-purple/10 text-purple border-purple/20",
  OVERVALUED: "bg-red/10 text-red border-red/20",
};

function formatPercent(n) {
  if (n == null) return "N/A";
  return `${(n * 100).toFixed(2)}%`;
}

export default function TickerCard({
  stock, analysis, onViewFull, onCompare, onAdvice,
  compareMode = false, isCompareSource = false, onSelect,
}) {
  const verdictStyle = VERDICT_STYLES[analysis?.verdict] || "bg-surface text-text-muted border-border";

  const borderClass = isCompareSource
    ? "border-accent ring-2 ring-accent/20"
    : compareMode
      ? "border-green/40 cursor-pointer hover:border-green hover:ring-2 hover:ring-green/15"
      : "border-border hover:border-accent-light/50 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5";

  return (
    <div
      className={`card-base p-6 transition-all duration-200 ${borderClass}`}
      onClick={compareMode && !isCompareSource ? onSelect : undefined}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="heading text-lg font-bold text-text-primary">{stock.name}</h3>
          <span className="mono text-sm font-medium text-accent">{stock.ticker}</span>
        </div>
        <span className="mono text-2xl font-bold text-text-primary">
          {stock.price != null ? `$${Number(stock.price).toFixed(2)}` : "N/A"}
        </span>
      </div>

      {/* Metrics */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-0.5 text-xs text-text-muted">P/E Ratio</p>
          <p className="mono text-sm font-medium">
            <FinanceTerm
              term={stock.pe_ratio ?? "N/A"}
              definition={analysis?.pe_explanation || "How much investors pay for every $1 of profit. Lower usually means cheaper."}
            />
          </p>
        </div>
        <div>
          <p className="mb-0.5 text-xs text-text-muted">Dividend Yield</p>
          <p className="mono text-sm font-medium text-text-primary">
            <FinanceTerm
              term={formatPercent(stock.dividend_yield)}
              definition="The percentage of the stock price paid back to you each year as dividends."
            />
          </p>
        </div>
      </div>

      {/* Verdict badge */}
      {analysis?.verdict ? (
        <div className="mb-4">
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${verdictStyle}`}>
            {analysis.verdict}
          </span>
        </div>
      ) : analysis && !analysis.verdict ? (
        <div className="mb-4">
          <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-muted">
            Analysis unavailable
          </span>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onViewFull}
          className="flex-1 rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md"
        >
          View Full
        </button>
        <button
          onClick={onCompare}
          className="flex-1 rounded-full border border-accent px-3 py-2 text-xs font-semibold text-accent transition-all hover:-translate-y-px hover:bg-accent hover:text-white"
        >
          Compare
        </button>
        <button
          onClick={onAdvice}
          className="flex-1 rounded-full border border-accent px-3 py-2 text-xs font-semibold text-accent transition-all hover:-translate-y-px hover:bg-accent hover:text-white"
        >
          Get Advice
        </button>
      </div>
    </div>
  );
}
