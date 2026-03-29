import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, Legend,
  BarChart, Bar, Cell, Area, AreaChart,
} from "recharts";
import { fetchMetrics, fetchFinancials, fetchHealth, fetchSec, fetchNews, fetchOhlcv } from "../api";
import FinanceTerm from "./FinanceTerm";
import MetricCard from "./MetricCard";
import NewsCard from "./NewsCard";
import ErrorCard from "./ErrorCard";
import { SkeletonMetric, SkeletonChart, SkeletonSection } from "./Skeleton";
import StatisticsPanel from "./StatisticsPanel";
import wrapFinanceTerms from "../utils/wrapFinanceTerms";

const VERDICT_STYLES = {
  UNDERVALUED: "bg-green/10 text-green border-green/20",
  "FAIR VALUATION": "bg-yellow/10 text-yellow border-yellow/20",
  "EXPENSIVE BUT GROWING": "bg-purple/10 text-purple border-purple/20",
  OVERVALUED: "bg-red/10 text-red border-red/20",
};

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

// Section wrapper with loading/error/empty
function Section({ title, children, loading, error, onRetry, skeleton }) {
  return (
    <section className="fade-in mb-10">
      <h3 className="heading mb-4 text-base font-bold text-text-primary">{title}</h3>
      {loading ? (skeleton || <SkeletonSection />) : error ? (
        <ErrorCard message={error} onRetry={onRetry} />
      ) : children}
    </section>
  );
}

export default function FullAnalysis({ stock, analysis, onClose }) {
  const [visible, setVisible] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const ticker = stock.ticker;

  // Async data + error states
  const [ohlcv, setOhlcv] = useState(null);
  const [ohlcvLoading, setOhlcvLoading] = useState(true);
  const [ohlcvError, setOhlcvError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [financialsLoading, setFinancialsLoading] = useState(true);
  const [financialsError, setFinancialsError] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);
  const [sec, setSec] = useState(null);
  const [secLoading, setSecLoading] = useState(true);
  const [secError, setSecError] = useState(null);
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(null);

  function loadEndpoint(fn, setData, setLoading, setErr) {
    setLoading(true); setErr(null);
    fn(ticker).then(setData).catch(() => setErr("Couldn't load this. Try again.")).finally(() => setLoading(false));
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    function onKey(e) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    loadEndpoint(fetchOhlcv, setOhlcv, setOhlcvLoading, setOhlcvError);
    loadEndpoint(fetchMetrics, setMetrics, setMetricsLoading, setMetricsError);
    loadEndpoint(fetchFinancials, setFinancials, setFinancialsLoading, setFinancialsError);
    loadEndpoint(fetchHealth, setHealth, setHealthLoading, setHealthError);
    loadEndpoint(fetchSec, setSec, setSecLoading, setSecError);
    loadEndpoint(fetchNews, setNews, setNewsLoading, setNewsError);
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
                  <span className={`verdict-pulse rounded-full border px-3 py-0.5 text-[11px] font-semibold ${verdictStyle}`}>{analysis.verdict}</span>
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

          {/* ===== PRICE CHART ===== */}
          <Section title="Price History (1 Year)" loading={ohlcvLoading} error={ohlcvError} onRetry={() => loadEndpoint(fetchOhlcv, setOhlcv, setOhlcvLoading, setOhlcvError)} skeleton={<SkeletonChart />}>
            {ohlcv && ohlcv.length > 0 && (() => {
              const first = ohlcv[0].close;
              const last = ohlcv[ohlcv.length - 1].close;
              const up = last >= first;
              const strokeColor = up ? "#2E7D5E" : "#C0392B";
              const fillColor = up ? "rgba(46,125,94,0.08)" : "rgba(192,57,43,0.08)";
              return (
                <div className="card-base p-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={ohlcv} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D6E4F0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#8AA0B8" }}
                        tickFormatter={(d) => { const p = d.split("-"); return `${p[1]}/${p[2]}`; }}
                        interval={Math.floor(ohlcv.length / 6)}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#8AA0B8" }}
                        width={55}
                        domain={["dataMin - 5", "dataMax + 5"]}
                        tickFormatter={(v) => `$${v.toFixed(0)}`}
                      />
                      <ReTooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #D6E4F0", fontSize: 12 }}
                        formatter={(v, name) => [`$${Number(v).toFixed(2)}`, name === "close" ? "Close" : name]}
                        labelFormatter={(d) => d}
                      />
                      <Area type="monotone" dataKey="close" stroke={strokeColor} strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  {/* Volume bar below */}
                  <ResponsiveContainer width="100%" height={60}>
                    <BarChart data={ohlcv} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <ReTooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #D6E4F0", fontSize: 11 }}
                        formatter={(v) => [`${(v / 1e6).toFixed(1)}M`, "Volume"]}
                        labelFormatter={(d) => d}
                      />
                      <Bar dataKey="volume" fill="#C8DFF0" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </Section>

          {/* ===== SECTION 2 — What They Do ===== */}
          <section className="fade-in mb-10">
            <h3 className="heading mb-4 text-base font-bold text-text-primary">What They Do</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              {wrapFinanceTerms(analysis?.what_they_do || stock.description)}
            </p>
          </section>

          {/* ===== SECTION 3 — Key Metrics + Statistics ===== */}
          <section className="fade-in mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="heading text-base font-bold text-text-primary">
                {showStats ? "Financial Statistics" : "Key Metrics"}
              </h3>
              <button
                onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-1.5 rounded-full border border-accent px-3 py-1.5 text-[11px] font-semibold text-accent transition-all hover:-translate-y-px hover:bg-accent hover:text-white"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showStats ? (
                    <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>
                  ) : (
                    <><path d="M3 12h18M3 6h18M3 18h18"/></>
                  )}
                </svg>
                {showStats ? "Key Metrics" : "All Statistics"}
              </button>
            </div>

            {showStats ? (
              <StatisticsPanel ticker={ticker} />
            ) : (
              metricsLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonMetric key={i} />)}
                </div>
              ) : metricsError ? (
                <ErrorCard message={metricsError} onRetry={() => loadEndpoint(fetchMetrics, setMetrics, setMetricsLoading, setMetricsError)} />
              ) : metrics && Array.isArray(metrics) ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {metrics.map((m, i) => <MetricCard key={i} metric={m} />)}
                </div>
              ) : null
            )}
          </section>

          {/* ===== SECTION 4 — Historical Performance ===== */}
          <Section title="Financial Trends" loading={financialsLoading} error={financialsError} onRetry={() => loadEndpoint(fetchFinancials, setFinancials, setFinancialsLoading, setFinancialsError)} skeleton={<SkeletonChart />}>
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
          <Section title="Health Check" loading={healthLoading} error={healthError} onRetry={() => loadEndpoint(fetchHealth, setHealth, setHealthLoading, setHealthError)}>
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
          <Section title="From the Latest SEC Filing" loading={secLoading} error={secError} onRetry={() => loadEndpoint(fetchSec, setSec, setSecLoading, setSecError)}>
            {sec && (
              <div className="space-y-6">
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

                {/* Business Segments — Revenue bar chart + table */}
                {sec.business_segments && sec.business_segments.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-text-primary">Business Segments</h4>
                    <div className="card-base p-4">
                      <ResponsiveContainer width="100%" height={Math.max(200, sec.business_segments.length * 50)}>
                        <BarChart data={sec.business_segments} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#D6E4F0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: "#8AA0B8" }} tickFormatter={(v) => `${v}%`} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#4A6580" }} width={140} />
                          <ReTooltip formatter={(v, name) => [`${v}%`, name === "margin_percent" ? "Operating Margin" : name]} />
                          <Bar dataKey="margin_percent" name="Operating Margin" fill="#2C5F8A" radius={[0, 4, 4, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 card-base overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface">
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-text-muted">Segment</th>
                            <th className="mono px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">
                              <FinanceTerm term="Revenue" />
                            </th>
                            <th className="mono px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">
                              <FinanceTerm term="Op. Income" definition="Operating income — profit from core business operations before interest and taxes." />
                            </th>
                            <th className="mono px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">Margin</th>
                            <th className="mono px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">YoY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sec.business_segments.map((seg, i) => (
                            <tr key={i} className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "bg-card" : "bg-surface"}`}>
                              <td className="px-4 py-2 font-medium text-text-primary">{seg.name}</td>
                              <td className="mono px-4 py-2 text-right text-text-secondary">{seg.revenue || "—"}</td>
                              <td className="mono px-4 py-2 text-right text-text-secondary">{seg.operating_income || "—"}</td>
                              <td className="mono px-4 py-2 text-right font-medium text-text-primary">{seg.margin_percent != null ? `${seg.margin_percent}%` : "—"}</td>
                              <td className={`mono px-4 py-2 text-right text-xs font-medium ${String(seg.yoy_revenue_change).startsWith("-") ? "text-red" : "text-green"}`}>
                                {seg.yoy_revenue_change || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Geographic Segments — Horizontal bar + table */}
                {sec.geographic_segments && sec.geographic_segments.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-text-primary">Geographic Breakdown</h4>
                    <div className="card-base p-4">
                      <ResponsiveContainer width="100%" height={Math.max(180, sec.geographic_segments.length * 45)}>
                        <BarChart data={sec.geographic_segments} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#D6E4F0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: "#8AA0B8" }} tickFormatter={(v) => `${v}%`} domain={[0, "dataMax"]} />
                          <YAxis type="category" dataKey="region" tick={{ fontSize: 11, fill: "#4A6580" }} width={130} />
                          <ReTooltip formatter={(v) => [`${v}%`, "% of Total Revenue"]} />
                          <Bar dataKey="percent_of_total" name="% of Revenue" radius={[0, 4, 4, 0]} barSize={16}>
                            {sec.geographic_segments.map((_, i) => (
                              <Cell key={i} fill={["#2C5F8A", "#4A90C4", "#5B4FCF", "#2E7D5E", "#B8860B", "#8AA0B8"][i % 6]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 card-base overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface">
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-text-muted">Region</th>
                            <th className="mono px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">Revenue</th>
                            <th className="mono px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">% of Total</th>
                            <th className="mono px-4 py-2 text-right text-xs font-semibold uppercase text-text-muted">YoY Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sec.geographic_segments.map((geo, i) => (
                            <tr key={i} className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "bg-card" : "bg-surface"}`}>
                              <td className="px-4 py-2 font-medium text-text-primary">{geo.region}</td>
                              <td className="mono px-4 py-2 text-right text-text-secondary">{geo.revenue || "—"}</td>
                              <td className="mono px-4 py-2 text-right font-medium text-text-primary">{geo.percent_of_total != null ? `${geo.percent_of_total}%` : "—"}</td>
                              <td className={`mono px-4 py-2 text-right text-xs font-medium ${String(geo.yoy_change).startsWith("-") ? "text-red" : "text-green"}`}>
                                {geo.yoy_change || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                            <span className="mt-0.5 text-red">&#x2022;</span>{wrapFinanceTerms(r)}
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
                            <span className="mt-0.5 text-green">&#x2022;</span>{wrapFinanceTerms(o)}
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
          <Section title="Latest News & What It Means" loading={newsLoading} error={newsError} onRetry={() => loadEndpoint(fetchNews, setNews, setNewsLoading, setNewsError)}>
            {news && news.length > 0 ? (
              <div className="space-y-3">
                {news.map((article, i) => <NewsCard key={i} article={article} />)}
              </div>
            ) : news && news.length === 0 ? (
              <div className="rounded-xl bg-surface px-5 py-8 text-center">
                <p className="text-sm text-text-muted">No recent news found for {ticker}.</p>
              </div>
            ) : null}
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
