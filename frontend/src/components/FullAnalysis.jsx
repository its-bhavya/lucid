import { useEffect, useState } from "react";
import FinanceTerm from "./FinanceTerm";

const VERDICT_STYLES = {
  UNDERVALUED: "bg-green/10 text-green border-green/20",
  "FAIR VALUATION": "bg-yellow/10 text-yellow border-yellow/20",
  "EXPENSIVE BUT GROWING": "bg-purple/10 text-purple border-purple/20",
  OVERVALUED: "bg-red/10 text-red border-red/20",
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

export default function FullAnalysis({ stock, analysis, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    function onKey(e) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const verdictStyle = VERDICT_STYLES[analysis?.verdict] || "bg-surface text-text-muted border-border";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        className={`relative mx-4 my-10 w-full max-w-[800px] card-base shadow-[var(--shadow-card-hover)] transition-all duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <div className="p-8">
          {/* Analysis unavailable banner */}
          {(!analysis || analysis._error) && (
            <div className="mb-6 rounded-xl border border-yellow/20 bg-yellow/5 px-4 py-3 text-sm text-yellow">
              AI analysis unavailable — showing stock data only
            </div>
          )}

          {/* Section 1 — Header */}
          <div className="mb-8 flex items-start justify-between pr-8">
            <div>
              <h2 className="heading text-2xl font-bold text-text-primary">{stock.name}</h2>
              <span className="mono text-sm font-medium text-accent">{stock.ticker}</span>
            </div>
            <div className="text-right">
              <p className="mono text-3xl font-bold text-text-primary">
                {stock.price != null ? `$${Number(stock.price).toFixed(2)}` : "N/A"}
              </p>
              {analysis?.verdict && (
                <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-semibold ${verdictStyle}`}>
                  {analysis.verdict}
                </span>
              )}
            </div>
          </div>

          {/* Section 2 — What They Do */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                </svg>
              </span>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">What They Do</h3>
            </div>
            <p className="rounded-xl bg-surface p-4 text-sm leading-relaxed text-text-secondary">
              {analysis?.what_they_do || stock.description}
            </p>
          </section>

          {/* Section 3 — Key Metrics, Explained */}
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Key Metrics, Explained
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="card-base p-4">
                <p className="text-xs text-text-muted">P/E Ratio</p>
                <p className="mono mt-1 text-xl font-bold text-text-primary">
                  <FinanceTerm
                    term={stock.pe_ratio ?? "N/A"}
                    definition="How much investors pay for every $1 of profit. Lower usually means cheaper."
                  />
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">
                  {analysis?.pe_explanation || "Explanation unavailable"}
                </p>
              </div>
              <div className="card-base p-4">
                <p className="text-xs text-text-muted">Free Cash Flow</p>
                <p className="mono mt-1 text-xl font-bold text-text-primary">
                  <FinanceTerm
                    term={formatNumber(stock.free_cash_flow)}
                    definition="Money left over after paying all bills and buying equipment. More is better."
                  />
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">
                  {analysis?.fcf_explanation || "Explanation unavailable"}
                </p>
              </div>
              <div className="card-base p-4">
                <p className="text-xs text-text-muted">Profit Margin</p>
                <p className="mono mt-1 text-xl font-bold text-text-primary">
                  <FinanceTerm
                    term={formatPercent(stock.profit_margin)}
                    definition="How many cents of profit a company keeps from each dollar of revenue."
                  />
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">
                  Higher is better
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 — Is It Healthy? */}
          {analysis?.health_summary && (
            <section className="mb-8">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                Is It Healthy?
              </h3>
              <div className="space-y-2">
                {analysis.health_summary.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3"
                  >
                    <span className={`mt-0.5 text-base ${item.icon === "\u2713" || item.icon === "\u2714" || item.icon === "\u2705" || item.icon === "\u2714\uFE0F" ? "text-green" : "text-yellow"}`}>
                      {item.icon}
                    </span>
                    <span className="text-sm text-text-secondary">{item.text}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 5 — Verdict */}
          {analysis?.verdict && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                Verdict
              </h3>
              <div className={`rounded-2xl border p-5 ${verdictStyle}`}>
                <p className="heading text-lg font-bold">{analysis.verdict}</p>
                <p className="mt-2 text-sm opacity-80">
                  {analysis.verdict_reason}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
