import { useState, useEffect } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import { fetchCompareData } from "../api";
import FinanceTerm from "./FinanceTerm";
import LoadingSpinner from "./LoadingSpinner";

const COLOR1 = "#2C5F8A"; // accent navy
const COLOR2 = "#5B4FCF"; // purple
const GREEN_BG = "bg-green/8";

const METRIC_DEFS = {
  "P/E": "How much investors pay per $1 of profit. Lower often means cheaper.",
  "EPS": "Earnings per share — how much profit each share of stock earned.",
  "Dividend Yield": "Yearly dividend payment as a percentage of the stock price.",
  "Debt/Equity": "How much debt a company uses compared to shareholder equity. Lower is safer.",
  "Revenue Growth": "How fast the company's sales are increasing year-over-year.",
  "Dividend": "Yearly dividend payment as a percentage of the stock price.",
  "Growth": "How fast the company's sales are increasing year-over-year.",
  "Margin": "How many cents of profit the company keeps from each dollar of revenue.",
  "Debt": "How much debt a company uses compared to shareholder equity. Lower is safer.",
};

const BETTER_IS_LOWER = ["P/E", "Debt/Equity", "Debt"];
const BETTER_IS_HIGHER = ["EPS", "Dividend Yield", "Revenue Growth", "Growth", "Margin", "Dividend"];

function parseNumeric(val) {
  if (val == null) return null;
  const s = String(val).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function betterCell(metric, v1, v2) {
  const n1 = parseNumeric(v1);
  const n2 = parseNumeric(v2);
  if (n1 == null || n2 == null || n1 === n2) return [false, false];
  const lower = BETTER_IS_LOWER.some((m) => metric.includes(m));
  const higher = BETTER_IS_HIGHER.some((m) => metric.includes(m));
  if (lower) return n1 < n2 ? [true, false] : [false, true];
  if (higher) return n1 > n2 ? [true, false] : [false, true];
  return [false, false];
}

function billionFmt(v) {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v}`;
}

const MARGIN_LABELS = [
  { key: "gross_margin", label: "Gross Margin", def: "Revenue minus cost of goods sold, as a percentage. Shows pricing power." },
  { key: "operating_margin", label: "Operating Margin", def: "Profit after operating expenses but before taxes and interest." },
  { key: "net_margin", label: "Net Margin", def: "The bottom line — what percentage of revenue becomes actual profit." },
  { key: "fcf_margin", label: "FCF Margin", def: "Free cash flow as a percentage of revenue. Shows cash generation efficiency." },
];

export default function CompareView({ stock1, stock2, comparison, onBack }) {
  const [revenueData, setRevenueData] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

  useEffect(() => {
    fetchCompareData(stock1.ticker, stock2.ticker)
      .then(setRevenueData)
      .catch(() => {})
      .finally(() => setRevenueLoading(false));
  }, [stock1.ticker, stock2.ticker]);

  // Build radar data
  const radarData = comparison.radar ? [
    { dimension: "Valuation", stock1: comparison.radar.stock1?.valuation ?? 0, stock2: comparison.radar.stock2?.valuation ?? 0 },
    { dimension: "Growth", stock1: comparison.radar.stock1?.growth ?? 0, stock2: comparison.radar.stock2?.growth ?? 0 },
    { dimension: "Profitability", stock1: comparison.radar.stock1?.profitability ?? 0, stock2: comparison.radar.stock2?.profitability ?? 0 },
    { dimension: "Safety", stock1: comparison.radar.stock1?.safety ?? 0, stock2: comparison.radar.stock2?.safety ?? 0 },
    { dimension: "Dividend", stock1: comparison.radar.stock1?.dividend ?? 0, stock2: comparison.radar.stock2?.dividend ?? 0 },
  ] : null;

  // Build margin data
  const marginData = comparison.margins ? MARGIN_LABELS.map(({ key, label }) => ({
    label,
    stock1: comparison.margins.stock1?.[key] ?? 0,
    stock2: comparison.margins.stock2?.[key] ?? 0,
  })) : null;

  // Pick data
  const pickGrowth = typeof comparison.pick_if_growth === "object" ? comparison.pick_if_growth : { ticker: comparison.pick_if_growth, reasons: [] };
  const pickStability = typeof comparison.pick_if_stability === "object" ? comparison.pick_if_stability : { ticker: comparison.pick_if_stability, reasons: [] };

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-6 mb-8 border-b border-border bg-card/95 px-6 py-4 shadow-[var(--shadow-card)] backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-accent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="mono text-sm font-bold text-text-primary">{stock1.ticker}</span>
              <span className="mono ml-1 text-sm text-text-secondary">${Number(stock1.price || 0).toFixed(0)}</span>
            </div>
            <span className="text-xs font-bold text-text-muted">vs</span>
            <div>
              <span className="mono text-sm font-bold text-text-primary">{stock2.ticker}</span>
              <span className="mono ml-1 text-sm text-text-secondary">${Number(stock2.price || 0).toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full header card */}
      <div className="card-base mb-10 flex items-center justify-between p-6">
        <div className="flex-1 text-center">
          <p className="heading text-xl font-bold text-text-primary">{stock1.name}</p>
          <p className="mono text-sm font-medium" style={{ color: COLOR1 }}>{stock1.ticker}</p>
          <p className="mono mt-1 text-3xl font-bold text-text-primary">
            {stock1.price != null ? `$${Number(stock1.price).toFixed(2)}` : "N/A"}
          </p>
        </div>
        <div className="mx-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface">
          <span className="heading text-sm font-bold text-text-muted">vs</span>
        </div>
        <div className="flex-1 text-center">
          <p className="heading text-xl font-bold text-text-primary">{stock2.name}</p>
          <p className="mono text-sm font-medium" style={{ color: COLOR2 }}>{stock2.ticker}</p>
          <p className="mono mt-1 text-3xl font-bold text-text-primary">
            {stock2.price != null ? `$${Number(stock2.price).toFixed(2)}` : "N/A"}
          </p>
        </div>
      </div>

      {/* ===== CHART 1 — Radar ===== */}
      {radarData && (
        <section className="mb-10">
          <h3 className="heading mb-4 text-base font-bold text-text-primary">At a Glance</h3>
          <div className="card-base p-6">
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#D6E4F0" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: "#4A6580" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#8AA0B8" }} />
                <Radar name={stock1.ticker} dataKey="stock1" stroke={COLOR1} fill={COLOR1} fillOpacity={0.2} strokeWidth={2} />
                <Radar name={stock2.ticker} dataKey="stock2" stroke={COLOR2} fill={COLOR2} fillOpacity={0.2} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ===== CHART 2 — Revenue Bar Chart ===== */}
      <section className="mb-10">
        <h3 className="heading mb-4 text-base font-bold text-text-primary">Revenue History</h3>
        {revenueLoading ? <LoadingSpinner message="Loading revenue data..." /> : revenueData && revenueData.length > 0 ? (
          <div className="card-base p-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D6E4F0" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#8AA0B8" }} />
                <YAxis tickFormatter={billionFmt} tick={{ fontSize: 11, fill: "#8AA0B8" }} width={65} />
                <Tooltip formatter={(v) => billionFmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="stock1_revenue" name={stock1.ticker} fill={COLOR1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="stock2_revenue" name={stock2.ticker} fill={COLOR2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm italic text-text-muted">Revenue data unavailable</p>
        )}
      </section>

      {/* ===== CHART 3 — Margins Horizontal Bar ===== */}
      {marginData && (
        <section className="mb-10">
          <h3 className="heading mb-4 text-base font-bold text-text-primary">Margins Comparison</h3>
          <div className="card-base p-6">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={marginData} layout="vertical" barGap={2} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D6E4F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8AA0B8" }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#4A6580" }} width={130} />
                <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="stock1" name={stock1.ticker} fill={COLOR1} radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="stock2" name={stock2.ticker} fill={COLOR2} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
            {/* Margin definitions */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3">
              {MARGIN_LABELS.map(({ label, def }) => (
                <span key={label} className="text-[11px] text-text-muted">
                  <FinanceTerm term={label} definition={def} />
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== METRIC TABLE ===== */}
      <section className="mb-10">
        <h3 className="heading mb-4 text-base font-bold text-text-primary">Key Metrics</h3>
        <div className="card-base overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Metric</th>
                <th className="mono px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: COLOR1 }}>{stock1.ticker}</th>
                <th className="mono px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: COLOR2 }}>{stock2.ticker}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.table?.map((row, i) => {
                const [b1, b2] = betterCell(row.metric, row.stock1_value, row.stock2_value);
                const def = Object.entries(METRIC_DEFS).find(([k]) => row.metric.includes(k))?.[1] || "";
                return (
                  <tr key={i} className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "bg-card" : "bg-surface"}`}>
                    <td className="px-5 py-3 text-sm font-medium text-text-primary">
                      <FinanceTerm term={row.metric} definition={def} />
                    </td>
                    <td className={`mono px-5 py-3 text-right text-sm font-medium ${b1 ? "text-green" : "text-text-secondary"}`}>
                      <span className={b1 ? "rounded-md bg-green/8 px-2 py-0.5" : ""}>{row.stock1_value ?? "N/A"}</span>
                    </td>
                    <td className={`mono px-5 py-3 text-right text-sm font-medium ${b2 ? "text-green" : "text-text-secondary"}`}>
                      <span className={b2 ? "rounded-md bg-green/8 px-2 py-0.5" : ""}>{row.stock2_value ?? "N/A"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== AI VERDICT ===== */}
      <section className="mb-10">
        <h3 className="heading mb-4 text-base font-bold text-text-primary">AI Verdict</h3>

        {/* Pick cards */}
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card-base p-5" style={{ borderColor: `${COLOR1}33`, background: `${COLOR1}08` }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: COLOR1 }}>
              Choose {pickGrowth.ticker} if you want growth
            </p>
            {pickGrowth.reasons?.length > 0 ? (
              <ul className="space-y-1.5">
                {pickGrowth.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span style={{ color: COLOR1 }} className="mt-0.5">&#x2022;</span>{r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="heading text-lg font-bold text-text-primary">{pickGrowth.ticker}</p>
            )}
          </div>

          <div className="card-base p-5" style={{ borderColor: `${COLOR2}33`, background: `${COLOR2}08` }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: COLOR2 }}>
              Choose {pickStability.ticker} if you want stability
            </p>
            {pickStability.reasons?.length > 0 ? (
              <ul className="space-y-1.5">
                {pickStability.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span style={{ color: COLOR2 }} className="mt-0.5">&#x2022;</span>{r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="heading text-lg font-bold text-text-primary">{pickStability.ticker}</p>
            )}
          </div>
        </div>

        {/* Overall verdict */}
        <div className="card-base p-5">
          <p className="text-sm leading-relaxed text-text-secondary">{comparison.verdict}</p>
        </div>
      </section>

      {/* Back button */}
      <div className="flex justify-center pb-4">
        <button
          onClick={onBack}
          className="rounded-full border border-accent px-6 py-3 text-sm font-semibold text-accent transition-all hover:-translate-y-px hover:bg-accent hover:text-white hover:shadow-md"
        >
          Back to Watchlist
        </button>
      </div>
    </div>
  );
}
