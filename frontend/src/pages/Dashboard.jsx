import { useState, useEffect, useCallback } from "react";
import { fetchStock, analyzeStock, compareStocks, fetchSuggestions } from "../api";
import SuggestionCard from "../components/SuggestionCard";
import FullAnalysis from "../components/FullAnalysis";
import CompareView from "../components/CompareView";
import AdviceForm from "../components/AdviceForm";
import ErrorCard from "../components/ErrorCard";
import { SkeletonCard, SkeletonRow } from "../components/Skeleton";
import LoadingSpinner from "../components/LoadingSpinner";

const STORAGE_KEY = "lucid_watchlist";

function loadWatchlist() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveWatchlist(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const VERDICT_STYLES = {
  UNDERVALUED: "bg-green/10 text-green",
  "FAIR VALUATION": "bg-yellow/10 text-yellow",
  "EXPENSIVE BUT GROWING": "bg-purple/10 text-purple",
  OVERVALUED: "bg-red/10 text-red",
};

function todayFormatted() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export default function Dashboard() {
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState(null);

  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [ticker, setTicker] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [selectedItem, setSelectedItem] = useState(null);
  const [adviceItem, setAdviceItem] = useState(null);

  // Compare flow
  const [compareSource, setCompareSource] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState(null);

  useEffect(() => { saveWatchlist(watchlist); }, [watchlist]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true); setSuggestionsError(null);
    try { setSuggestions(await fetchSuggestions()); }
    catch { setSuggestionsError("Couldn't load suggestions."); }
    finally { setSuggestionsLoading(false); }
  }, []);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  function isInWatchlist(t) { return watchlist.some((i) => i.stock.ticker === t); }

  async function addToWatchlist(stockData) {
    if (isInWatchlist(stockData.ticker)) return;
    setAddLoading(true);
    try {
      let analysis = null;
      try { analysis = await analyzeStock(stockData); } catch { analysis = { _error: true }; }
      setWatchlist((prev) => [{ stock: stockData, analysis }, ...prev]);
    } catch { setError("Failed to analyze stock"); }
    finally { setAddLoading(false); }
  }

  async function addTicker(symbol) {
    const t = symbol.trim().toUpperCase();
    if (!t) return;
    if (isInWatchlist(t)) { setError(`${t} is already in your watchlist`); return; }
    setAddLoading(true); setError(null);
    try {
      const stock = await fetchStock(t);
      let analysis = null;
      try { analysis = await analyzeStock(stock); } catch { analysis = { _error: true }; }
      setWatchlist((prev) => [{ stock, analysis }, ...prev]);
      setTicker("");
    } catch (err) { setError(err.response?.data?.detail || `Ticker "${t}" not found`); }
    finally { setAddLoading(false); }
  }

  function handleAdd(e) { e.preventDefault(); addTicker(ticker); }

  async function handleViewAnalysis(stockData) {
    setAddLoading(true);
    try {
      let analysis = null;
      try { analysis = await analyzeStock(stockData); } catch { analysis = { _error: true }; }
      setSelectedItem({ stock: stockData, analysis });
    } finally { setAddLoading(false); }
  }

  function handleClear() { setWatchlist([]); }

  // --- Compare flow ---
  function handleCompareStart(item) {
    if (watchlist.length < 2) { setError("Add at least 2 stocks to compare"); return; }
    setCompareSource(item);
  }

  function handleCancelCompare() { setCompareSource(null); }

  async function handleCompareSelect(item) {
    if (!compareSource) return;
    setCompareLoading(true);
    try {
      const result = await compareStocks(compareSource.stock.ticker, item.stock.ticker);
      setCompareResult({ stock1: compareSource.stock, stock2: item.stock, comparison: result });
    } catch (err) {
      setError(err.response?.data?.detail || "Comparison failed");
    } finally { setCompareLoading(false); setCompareSource(null); }
  }

  // --- Compare result page ---
  if (compareResult) {
    return (
      <CompareView
        stock1={compareResult.stock1}
        stock2={compareResult.stock2}
        comparison={compareResult.comparison}
        onBack={() => setCompareResult(null)}
      />
    );
  }
  if (compareLoading) {
    return <LoadingSpinner message="Comparing stocks with AI..." />;
  }

  return (
    <div>
      {selectedItem && (
        <FullAnalysis stock={selectedItem.stock} analysis={selectedItem.analysis} onClose={() => setSelectedItem(null)} />
      )}
      {adviceItem && (
        <AdviceForm stock={adviceItem.stock} onClose={() => setAdviceItem(null)} />
      )}

      {/* Compare mode banner */}
      {compareSource && (
        <div className="card-base mb-6 flex items-center justify-between border-accent/20 bg-accent-soft/20 px-5 py-3">
          <p className="text-sm text-accent">
            Select another stock to compare with <span className="mono font-bold">{compareSource.stock.ticker}</span>
          </p>
          <button onClick={handleCancelCompare} className="text-xs font-medium text-text-muted transition-colors hover:text-red">Cancel</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        {/* LEFT — Suggestions */}
        <div className="fade-in">
          <div className="mb-5 flex items-center justify-between rounded-xl bg-surface px-4 py-3 sm:px-5">
            <div>
              <h2 className="heading text-lg font-bold text-text-primary">Suggested Stocks</h2>
              <p className="text-xs text-text-muted">US Equities</p>
            </div>
            <p className="hidden text-xs text-text-muted sm:block">{todayFormatted()}</p>
          </div>

          {suggestionsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : suggestionsError ? (
            <ErrorCard message={suggestionsError} onRetry={loadSuggestions} />
          ) : suggestions.length === 0 ? (
            <div className="rounded-xl bg-surface px-5 py-12 text-center">
              <p className="text-sm text-text-muted">No suggestions available right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {suggestions.map((stock) => (
                <SuggestionCard
                  key={stock.ticker}
                  stock={stock}
                  isInWatchlist={isInWatchlist(stock.ticker)}
                  onAdd={() => addToWatchlist(stock)}
                  onViewAnalysis={() => handleViewAnalysis(stock)}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Watchlist */}
        <div className="fade-in" style={{ animationDelay: "80ms" }}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="heading text-lg font-bold text-text-primary">Your Watchlist</h2>
              {watchlist.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                  {watchlist.length}
                </span>
              )}
            </div>
            {watchlist.length > 0 && (
              <button onClick={handleClear} className="text-xs text-text-muted transition-colors hover:text-red">Clear all</button>
            )}
          </div>

          <form onSubmit={handleAdd} className="mb-4">
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text" value={ticker} onChange={(e) => setTicker(e.target.value)}
                placeholder="Add a ticker..."
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-text-primary shadow-[var(--shadow-card)] placeholder-text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>
          </form>

          {error && (
            <div className="mb-3 rounded-xl border border-red/20 bg-red/5 px-3 py-2 text-xs text-red">{error}</div>
          )}

          {addLoading && (
            <div className="mb-3 card-base divide-y divide-border overflow-hidden">
              {Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          )}

          {watchlist.length > 0 ? (
            <div className="card-base divide-y divide-border overflow-hidden">
              {watchlist.map((item) => {
                const analysis = item.analysis?._error ? null : item.analysis;
                const verdictStyle = VERDICT_STYLES[analysis?.verdict] || "";
                const isComparing = !!compareSource;
                const isSource = compareSource?.stock.ticker === item.stock.ticker;

                return (
                  <div
                    key={item.stock.ticker}
                    className={`px-4 py-3 transition-all ${
                      isSource
                        ? "bg-accent-soft/20 ring-1 ring-inset ring-accent/20"
                        : isComparing
                          ? "cursor-pointer hover:bg-accent-soft/10"
                          : "hover:bg-card-hover"
                    }`}
                    onClick={isComparing && !isSource ? () => handleCompareSelect(item) : undefined}
                  >
                    {/* Row 1: ticker, price, verdict */}
                    <div className="flex items-center gap-3">
                      <div className="w-14">
                        <p className="mono text-sm font-bold text-text-primary">{item.stock.ticker}</p>
                      </div>
                      <div className="w-20 text-right">
                        <p className="mono text-sm font-medium text-text-primary">
                          {item.stock.price != null ? `$${Number(item.stock.price).toFixed(0)}` : "\u2014"}
                        </p>
                      </div>
                      <div className="flex-1">
                        {analysis?.verdict ? (
                          <span className={`verdict-pulse inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${verdictStyle}`}>
                            {analysis.verdict}
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-muted">\u2014</span>
                        )}
                      </div>
                    </div>
                    {/* Row 2: action buttons */}
                    {!isComparing && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                          className="rounded-full bg-accent px-3 py-1 text-[10px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-sm"
                        >
                          Analysis
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCompareStart(item); }}
                          className="rounded-full border border-accent px-3 py-1 text-[10px] font-semibold text-accent transition-all hover:-translate-y-px hover:bg-accent hover:text-white"
                        >
                          Compare
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAdviceItem(item); }}
                          className="rounded-full border border-accent px-3 py-1 text-[10px] font-semibold text-accent transition-all hover:-translate-y-px hover:bg-accent hover:text-white"
                        >
                          Advice
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !addLoading && (
              <div className="rounded-xl bg-surface px-5 py-10 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-text-muted/50">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm text-text-muted">Your watchlist is empty.</p>
                <p className="mt-1 text-xs text-text-muted/70">Add a stock above or pick from suggestions.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
