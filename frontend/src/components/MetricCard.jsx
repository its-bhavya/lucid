import FinanceTerm from "./FinanceTerm";

const TREND_ICON = {
  up: { arrow: "\u2191", color: "text-green" },
  down: { arrow: "\u2193", color: "text-red" },
  neutral: { arrow: "\u2192", color: "text-text-muted" },
};

export default function MetricCard({ metric }) {
  const trend = TREND_ICON[metric.trend] || TREND_ICON.neutral;

  return (
    <div className="card-base p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-text-muted">
          <FinanceTerm term={metric.metric_name} definition={metric.finance_term_definition} />
        </p>
        <span className={`text-sm ${trend.color}`}>{trend.arrow}</span>
      </div>
      <p className="mono text-xl font-bold text-text-primary">
        {metric.value}{metric.unit && <span className="text-sm text-text-secondary"> {metric.unit}</span>}
      </p>
      <p className="mt-1.5 text-[11px] italic leading-relaxed text-text-muted">
        {metric.why_it_matters}
      </p>
    </div>
  );
}
