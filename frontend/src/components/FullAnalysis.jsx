import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend as LineLegend,
} from "recharts";
import { fetchMetrics, fetchFinancials, fetchHealth, fetchSegments, fetchSec, fetchNews } from "../api";
import FinanceTerm from "./FinanceTerm";
import MetricCard from "./MetricCard";
import NewsCard from "./NewsCard";
import LoadingSpinner from "./LoadingSpinner";
import wrapFinanceTerms from "../utils/wrapFinanceTerms";

const VERDICT_STYLES = {
  UNDERVALUED: "bg-green/10 text-green border-green/20",
  "FAIR VALUATION": "bg-yellow/10 text-yellow border-yellow/20",
  "EXPENSIVE BUT GROWING": "bg-purple/10 text-purple border-purple/20",
  OVERVALUED: "bg-red/10 text-red border-red/20",
};

const PIE_COLORS = ["#2C5F8A", "#4A90C4", "#5B4FCF", "#2E7D5E", "#B8860B", "#C0392B"];

const TONE_STYLES = {
  positive: "bg-green/10 text-green border-green/20",
  neutral: "bg-yellow/10 text-yellow border-yellow/20",
  cautious: "bg-red/10 text-red border-red/20",
};

function billionFormatter(value) {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value}`;
}

function scoreColor(score) {
  if (score >= 70) return "bg-green";
  if (score >= 40) return "bg-yellow";
  return "bg-red";
}

function scoreLabel(score) {
  if (score >= 70) return "text-green";
  if (score >= 40) return "text-yellow";
  return "text-red";
}

// Section wrapper
function Section({ title, children, loading, error }) {
  return (
    <section className="mb-10">
      <h3 className="heading mb-4 text-base font-bold text-text-primary">{title}</h3>
      {loading ? <LoadingSpinner message="Loading..." /> : error ? (
        <p className="text-sm italic text-text-muted">{error}</p>
      ) : children}
    </section>
  );
}

export default function FullAnalysis({ stock, analysis, onClose }) {
  const [visible, setVisible] = useState(false);
  const ticker = stock.ticker;

  // Async data
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [financials, setFinancials] = useState(null);
  const [financialsLoading, setFinancialsLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [segments, setSegments] = useState(null);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [sec, setSec] = useState(null);
  const [secLoading, setSecLoading] = useState(true);
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    function onKey(e) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Fetch all data in parallel on mount
  useEffect(() => {
    fetchMetrics(ticker).then(setMetrics).catch(() => {}).finally(() => setMetricsLoading(false));
    fetchFinancials(ticker).then(setFinancials).catch(() => {}).finally(() => setFinancialsLoading(false));
    fetchHealth(ticker).then(setHealth).catch(() => {}).finally(() => setHealthLoading(false));
    fetchSegments(ticker).then(setSegments).catch(() => {}).finally(() => setSegmentsLoading(false));
    fetchSec(ticker).then(setSec).catch(() => {}).finally(() => setSecLoading(false));
    fetchNews(ticker).then(setNews).catch(() => {}).finally(() => setNewsLoading(false));
  }, [ticker]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const verdictStyle = VERDICT_STYLES[analysis?.verdict] || "bg-surface text-text-muted border-border";
  const changePositive = stock.change_percent != null && stock.change_percent >= 0;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        className={`relative mx-4 my-6 w-full max-w-[900px] card-base shadow-[var(--shadow-card-hover)] transition-all duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-muted transition-colors hover:bg-border hover:text-text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>

        <div className="p-8">
          {/* ===== SECTION 1 — Hero Header ===== */}
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="heading text-3xl font-extrabold text-text-primary">{stock.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="mono rounded-md bg-accent/10 px-2 py-0.5 text-sm font-bold text-accent">{ticker}</span>
                {stock.sector && <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">{stock.sector}</span>}
                {analysis?.verdict && (
                  <span className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold ${verdictStyle}`}>{analysis.verdict}</span>
                )}
              </div>
            </div>
            <div className="text-right sm:text-right">
              <p className="mono text-4xl font-bold text-text-primary">
                {stock.price != null ? `$${Number(stock.price).toFixed(2)}` : "N/A"}
              </p>
              {stock.change_percent != null && (
                <p className={`mono mt-1 text-sm font-medium ${changePositive ? "text-green" : "text-red"}`}>
                  {changePositive ? "\u2191" : "\u2193"} {changePositive ? "+" : ""}{(stock.change_percent * 100).toFixed(1)}% quarterly revenue growth
                </p>
              )}
            </div>
          </div>

          {/* ===== SECTION 2 — What They Do + Pie ===== */}
          <Section title="What They Do" loading={segmentsLoading}>
            <p className="mb-5 text-sm leading-relaxed text-text-secondary">
              {wrapFinanceTerms(analysis?.what_they_do || stock.description)}
            </p>
            {segments && Array.isArray(segments) && segments.length > 0 && (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={segments}
                      dataKey="percent"
                      nameKey="segment"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      paddingAngle={2}
                      label={({ segment, percent }) => `${segment} ${percent}%`}
                      labelLine={false}
                      style={{ fontSize: 11 }}
                    >
                      {segments.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip formatter={(value, name) => [`${value}%`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* ===== SECTION 3 — Key Metrics (dynamic) ===== */}
          <Section title="Key Metrics" loading={metricsLoading} error={!metricsLoading && !metrics ? "Metrics unavailable" : null}>
            {metrics && Array.isArray(metrics) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map((m, i) => <MetricCard key={i} metric={m} />)}
              </div>
            )}
          </Section>

          {/* ===== SECTION 4 — Historical Performance ===== */}
          <Section title="Financial Trends" loading={financialsLoading} error={!financialsLoading && !financials ? "Financial data unavailable" : null}>
            {financials && financials.length > 0 && (
              <div className="card-base p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={financials} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D6E4F0" />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#8AA0B8" }} />
                    <YAxis tickFormatter={billionFormatter} tick={{ fontSize: 11, fill: "#8AA0B8" }} width={65} />
                    <ReTooltip formatter={(v) => billionFormatter(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2C5F8A" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="net_income" name="Net Income" stroke="#2E7D5E" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="free_cash_flow" name="Free Cash Flow" stroke="#5B4FCF" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* ===== SECTION 5 — Health Check ===== */}
          <Section title="Health Check" loading={healthLoading} error={!healthLoading && !health ? "Health data unavailable" : null}>
            {health && (
              <div className="space-y-4">
                {[
                  { label: "Profitability Score", key: "profitability_score", def: "How effectively the company turns revenue into profit." },
                  { label: "Debt Safety Score", key: "debt_safety_score", def: "How well the company can handle its debt obligations." },
                  { label: "Growth Score", key: "growth_score", def: "How fast the company is expanding revenue and earnings." },
                ].map(({ label, key, def }) => {
                  const score = health[key] ?? 0;
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary">
                          <FinanceTerm term={label} definition={def} />
                        </p>
                        <span className={`mono text-sm font-bold ${scoreLabel(score)}`}>{score}</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${scoreColor(score)}`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ===== SECTION 6 — SEC Filings Intelligence ===== */}
          <Section title="From the Latest SEC Filing" loading={secLoading} error={!secLoading && !sec ? "SEC data unavailable" : null}>
            {sec && (
              <div className="space-y-4">
                {/* Filing date + tone */}
                <div className="flex flex-wrap items-center gap-3">
                  {sec.filing_date && (
                    <span className="text-xs text-text-muted">Filed: {sec.filing_date}</span>
                  )}
                  {sec.management_tone && (
                    <span className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold ${TONE_STYLES[sec.management_tone] || TONE_STYLES.neutral}`}>
                      Management tone: {sec.management_tone}
                    </span>
                  )}
                </div>

                {/* Segment KPIs table */}
                {sec.segment_kpis && sec.segment_kpis.length > 0 && (
                  <div className="card-base overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface">
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-text-muted">Segment</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-text-muted">KPI</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">Value</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">YoY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.segment_kpis.map((kpi, i) => (
                          <tr key={i} className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "bg-card" : "bg-surface"}`}>
                            <td className="px-4 py-2 text-text-primary">{kpi.segment}</td>
                            <td className="px-4 py-2">
                              <FinanceTerm term={kpi.kpi_name} definition={kpi.definition} />
                            </td>
                            <td className="mono px-4 py-2 text-right font-medium text-text-primary">{kpi.value}</td>
                            <td className={`mono px-4 py-2 text-right text-xs font-medium ${String(kpi.yoy_change).startsWith("-") ? "text-red" : "text-green"}`}>
                              {kpi.yoy_change}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Risks & Opportunities */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {sec.key_risks && (
                    <div className="card-base border-red/10 p-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red">Key Risks</h4>
                      <ul className="space-y-1.5">
                        {sec.key_risks.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                            <span className="mt-0.5 text-red">&#x2022;</span>{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sec.key_opportunities && (
                    <div className="card-base border-green/10 p-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-green">Key Opportunities</h4>
                      <ul className="space-y-1.5">
                        {sec.key_opportunities.map((o, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                            <span className="mt-0.5 text-green">&#x2022;</span>{o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* ===== SECTION 7 — Latest News ===== */}
          <Section title="Latest News & What It Means" loading={newsLoading} error={!newsLoading && (!news || news.length === 0) ? "No recent news found" : null}>
            {news && news.length > 0 && (
              <div className="space-y-3">
                {news.map((article, i) => <NewsCard key={i} article={article} />)}
              </div>
            )}
          </Section>

          {/* ===== Verdict (bottom) ===== */}
          {analysis?.verdict && (
            <section className="mb-4">
              <div className={`rounded-2xl border p-6 text-center ${verdictStyle}`}>
                <p className="heading text-2xl font-bold">{analysis.verdict}</p>
                <p className="mx-auto mt-2 max-w-lg text-sm opacity-80">{wrapFinanceTerms(analysis.verdict_reason)}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
