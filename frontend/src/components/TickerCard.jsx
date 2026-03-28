import { useState } from "react";

const VERDICT_STYLES = {
  UNDERVALUED: "bg-accent-green/15 text-accent-green",
  "FAIR VALUATION": "bg-yellow-500/15 text-yellow-400",
  "EXPENSIVE BUT GROWING": "bg-orange-500/15 text-orange-400",
  OVERVALUED: "bg-accent-red/15 text-accent-red",
};

function formatNumber(n) {
  if (n == null) return "N/A";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "N/A";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toFixed(2)}`;
}

function formatPercent(n) {
  if (n == null) return "N/A";
  return `${(n * 100).toFixed(2)}%`;
}

export default function TickerCard({
  stock, analysis, onViewFull, onCompare, onAdvice,
  compareMode = false, isCompareSource = false, onSelect,
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const verdictStyle = VERDICT_STYLES[analysis?.verdict] || "bg-card text-text-muted";

  const borderClass = isCompareSource
    ? "border-accent ring-1 ring-accent/30"
    : compareMode
      ? "border-accent-green/50 cursor-pointer hover:border-accent-green hover:ring-1 hover:ring-accent-green/30"
      : "border-border hover:border-accent/40";

  return (
    <div
      className={`rounded-xl border bg-card p-5 transition-all ${borderClass}`}
      onClick={compareMode && !isCompareSource ? onSelect : undefined}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{stock.name}</h3>
          <span className="text-sm font-medium text-accent">{stock.ticker}</span>
        </div>
        <span className="text-2xl font-bold text-white">
          {stock.price != null ? `$${Number(stock.price).toFixed(2)}` : "N/A"}
        </span>
      </div>

      {/* Metrics */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <p className="text-xs text-text-muted">P/E Ratio</p>
          <p className="cursor-help text-sm font-medium text-text-primary underline decoration-dotted">
            {stock.pe_ratio ?? "N/A"}
          </p>
          {showTooltip && analysis?.pe_explanation && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-lg border border-border bg-surface p-3 text-xs text-text-muted shadow-lg">
              {analysis.pe_explanation}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-text-muted">Dividend Yield</p>
          <p className="text-sm font-medium text-text-primary">
            {formatPercent(stock.dividend_yield)}
          </p>
        </div>
      </div>

      {/* Verdict badge */}
      {analysis?.verdict && (
        <div className="mb-4">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${verdictStyle}`}>
            {analysis.verdict}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onViewFull}
          className="flex-1 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
        >
          View Full
        </button>
        <button
          onClick={onCompare}
          className="flex-1 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
        >
          Compare
        </button>
        <button
          onClick={onAdvice}
          className="flex-1 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
        >
          Get Advice
        </button>
      </div>
    </div>
  );
}
