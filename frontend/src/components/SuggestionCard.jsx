import { useState } from "react";
import FinanceTerm from "./FinanceTerm";
import wrapFinanceTerms from "../utils/wrapFinanceTerms";

function formatPercent(n) {
  if (n == null) return "N/A";
  return `${(n * 100).toFixed(2)}%`;
}

function formatChange(n) {
  if (n == null) return null;
  const pct = (n * 100).toFixed(1);
  return { value: `${n >= 0 ? "+" : ""}${pct}%`, positive: n >= 0 };
}

export default function SuggestionCard({ stock, onAdd, onViewAnalysis, isInWatchlist }) {
  const [justAdded, setJustAdded] = useState(false);
  const change = formatChange(stock.change_percent);

  function handleAdd() {
    onAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }

  const btnLabel = justAdded ? "\u2713 Added" : isInWatchlist ? "In Watchlist" : "+ Add to Watchlist";
  const btnDisabled = isInWatchlist || justAdded;

  return (
    <div className="card-base p-5 transition-all duration-200 hover:-translate-y-1 hover:border-accent-light/50 hover:shadow-[var(--shadow-card-hover)]">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="heading text-base font-bold text-text-primary">{stock.name}</h3>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="mono text-sm font-medium text-accent">{stock.ticker}</span>
            {stock.category && (
              <span className="rounded-full bg-accent-soft/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                {stock.category}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="mono text-lg font-bold text-text-primary">
            {stock.price != null ? `$${Number(stock.price).toFixed(2)}` : "N/A"}
          </p>
          {change && (
            <p className={`mono text-xs font-medium ${change.positive ? "text-green" : "text-red"}`}>
              {change.value}
            </p>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="mb-3 flex items-center gap-4 border-t border-b border-border py-2.5">
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">P/E</p>
          <p className="mono mt-0.5 text-xs font-medium">
            <FinanceTerm term={stock.pe_ratio ?? "N/A"} />
          </p>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Yield</p>
          <p className="mono mt-0.5 text-xs font-medium">
            <FinanceTerm term={formatPercent(stock.dividend_yield)} definition="The percentage of the stock price paid back to you each year as dividends." />
          </p>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex-1 text-center">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Margin</p>
          <p className="mono mt-0.5 text-xs font-medium">
            <FinanceTerm term={formatPercent(stock.profit_margin)} definition="How many cents of profit a company keeps from each dollar of revenue." />
          </p>
        </div>
      </div>

      {/* One-liner */}
      {stock.one_liner && (
        <p className="mb-3 text-xs leading-relaxed text-text-secondary">
          {wrapFinanceTerms(stock.one_liner)}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAdd}
          disabled={btnDisabled}
          className={`flex-1 rounded-full py-2 text-xs font-semibold transition-all hover:-translate-y-px ${
            justAdded
              ? "border border-green/30 bg-green/10 text-green"
              : isInWatchlist
                ? "border border-green/20 bg-green/5 text-green"
                : "bg-accent text-white hover:shadow-md"
          }`}
        >
          {btnLabel}
        </button>
        <button
          onClick={onViewAnalysis}
          className="text-xs font-semibold text-accent-light transition-colors hover:text-accent"
        >
          View Analysis &rarr;
        </button>
      </div>
    </div>
  );
}
