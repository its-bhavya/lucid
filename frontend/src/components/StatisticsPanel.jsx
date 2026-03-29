import { useState, useEffect } from "react";
import { fetchStatistics } from "../api";
import FinanceTerm from "./FinanceTerm";
import ErrorCard from "./ErrorCard";
import { SkeletonSection } from "./Skeleton";

const CATEGORY_LABELS = {
  valuation: "Valuation Measures",
  profitability: "Profitability",
  balance_sheet: "Balance Sheet",
  cash_flow: "Cash Flow",
  income_statement: "Income Statement",
};

const CATEGORY_ORDER = ["valuation", "profitability", "income_statement", "balance_sheet", "cash_flow"];

function formatValue(value, fmt) {
  if (value == null) return "—";
  if (fmt === "dollar") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  if (fmt === "pct") return `${value.toFixed(1)}%`;
  if (fmt === "ratio") return value.toFixed(2);
  return String(value);
}

export default function StatisticsPanel({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("valuation");

  function load() {
    setLoading(true); setError(null);
    fetchStatistics(ticker)
      .then(setData)
      .catch(() => setError("Couldn't load statistics."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [ticker]);

  if (loading) return <SkeletonSection rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={load} />;
  if (!data) return null;

  const metrics = data[activeTab] || [];

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORY_ORDER.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
              activeTab === key
                ? "bg-accent text-white shadow-sm"
                : "bg-surface text-text-secondary hover:bg-accent-soft/30 hover:text-accent"
            }`}
          >
            {CATEGORY_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Metrics table */}
      <div className="card-base overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Metric</th>
              <th className="mono px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Value</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr
                key={m.name}
                className={`border-b border-border last:border-b-0 transition-colors hover:bg-card-hover ${i % 2 === 0 ? "bg-card" : "bg-surface"}`}
              >
                <td className="px-4 py-2.5 text-sm text-text-primary">
                  <FinanceTerm term={m.name} definition={m.definition} />
                </td>
                <td className="mono px-4 py-2.5 text-right text-sm font-medium text-text-primary">
                  {formatValue(m.value, m.fmt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
