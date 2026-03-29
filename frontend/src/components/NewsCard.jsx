import wrapFinanceTerms from "../utils/wrapFinanceTerms";

const SENTIMENT_DOT = {
  positive: "bg-green",
  neutral: "bg-text-muted",
  negative: "bg-red",
};

export default function NewsCard({ article }) {
  const dotColor = SENTIMENT_DOT[article.sentiment] || SENTIMENT_DOT.neutral;

  return (
    <div className="card-base flex gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      {/* Sentiment dot */}
      <div className="flex pt-1.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
      </div>

      <div className="min-w-0 flex-1">
        {/* Headline */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold leading-snug text-text-primary transition-colors hover:text-accent"
        >
          {article.headline}
        </a>

        {/* Source + date */}
        <p className="mt-1 text-[11px] text-text-muted">
          {article.source}
          {article.date && <> &middot; {new Date(article.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}
        </p>

        {/* Plain english meaning */}
        {article.plain_english_meaning && (
          <div className="mt-2 border-l-2 border-accent-soft pl-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">What this means</p>
            <p className="mt-0.5 text-xs italic leading-relaxed text-text-secondary">
              {wrapFinanceTerms(article.plain_english_meaning)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
