import { useState, useEffect } from "react";
import { fetchStock, analyzeStock, fetchSuggestions } from "../api";
import SuggestionCard from "../components/SuggestionCard";
import FullAnalysis from "../components/FullAnalysis";
import AdviceForm from "../components/AdviceForm";
import LoadingSpinner from "../components/LoadingSpinner";

const STORAGE_KEY = "lucid_watchlist";

function loadWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
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
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Dashboard() {
  // Suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState(null);

  // Watchlist
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [ticker, setTicker] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [selectedItem, setSelectedItem] = useState(null);
  const [adviceItem, setAdviceItem] = useState(null);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Load suggestions on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchSuggestions();
        if (!cancelled) setSuggestions(data);
      } catch (err) {
        if (!cancelled) setSuggestionsError("Failed to load suggestions");
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function isInWatchlist(tickerSymbol) {
    return watchlist.some((item) => item.stock.ticker === tickerSymbol);
  }

  async function addToWatchlist(stockData) {
    if (isInWatchlist(stockData.ticker)) return;
    setAddLoading(true);
    try {
      let analysis = null;
      try {
        analysis = await analyzeStock(stockData);
      } catch {
        analysis = { _error: true };
      }
      setWatchlist((prev) => [{ stock: stockData, analysis }, ...prev]);
    } catch {
      setError("Failed to analyze stock");
    } finally {
      setAddLoading(false);
    }
  }

  async function addTicker(symbol) {
    const t = symbol.trim().toUpperCase();
    if (!t) return;
    if (isInWatchlist(t)) {
      setError(`${t} is already in your watchlist`);
      return;
    }
    setAddLoading(true);
    setError(null);
    try {
      const stock = await fetchStock(t);
      let analysis = null;
      try {
        analysis = await analyzeStock(stock);
      } catch {
        analysis = { _error: true };
      }
      setWatchlist((prev) => [{ stock, analysis }, ...prev]);
      setTicker("");
    } catch (err) {
      const msg = err.response?.data?.detail || `Ticker "${t}" not found`;
      setError(msg);
    } finally {
      setAddLoading(false);
    }
  }

  function handleAdd(e) {
    e.preventDefault();
    addTicker(ticker);
  }

  async function handleViewAnalysis(stockData) {
    setAddLoading(true);
    try {
      let analysis = null;
      try {
        analysis = await analyzeStock(stockData);
      } catch {
        analysis = { _error: true };
      }
      setSelectedItem({ stock: stockData, analysis });
    } finally {
      setAddLoading(false);
    }
  }

  function handleClear() {
    setWatchlist([]);
  }

  return (
    <div>
      {/* Full analysis modal */}
      {selectedItem && (
        <FullAnalysis
          stock={selectedItem.stock}
          analysis={selectedItem.analysis}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Advice modal */}
      {adviceItem && (
        <AdviceForm
          stock={adviceItem.stock}
          onClose={() => setAdviceItem(null)}
        />
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        {/* LEFT COLUMN — Suggestions */}
        <div>
          {/* Markets header bar */}
          <div className="mb-5 flex items-center justify-between rounded-xl bg-surface px-5 py-3">
            <div>
              <h2 className="heading text-lg font-bold text-text-primary">Suggested Stocks</h2>
              <p className="text-xs text-text-muted">US Equities</p>
            </div>
            <p className="text-xs text-text-muted">{todayFormatted()}</p>
          </div>

          {/* Suggestions grid */}
          {suggestionsLoading ? (
            <LoadingSpinner message="Loading market suggestions..." />
          ) : suggestionsError ? (
            <div className="card-base border-red/20 bg-red/5 px-4 py-3 text-sm text-red">
              {suggestionsError}
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

        {/* RIGHT COLUMN — Watchlist */}
        <div>
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
              <button
                onClick={handleClear}
                className="text-xs text-text-muted transition-colors hover:text-red"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Search bar */}
          <form onSubmit={handleAdd} className="mb-4">
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="Add a ticker..."
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-text-primary shadow-[var(--shadow-card)] placeholder-text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="mb-3 rounded-xl border border-red/20 bg-red/5 px-3 py-2 text-xs text-red">
              {error}
            </div>
          )}

          {/* Loading */}
          {addLoading && (
            <div className="mb-3">
              <LoadingSpinner message="Adding..." />
            </div>
          )}

          {/* Watchlist rows */}
          {watchlist.length > 0 ? (
            <div className="card-base divide-y divide-border overflow-hidden">
              {watchlist.map((item) => {
                const analysis = item.analysis?._error ? null : item.analysis;
                const verdictStyle = VERDICT_STYLES[analysis?.verdict] || "";
                const change = item.stock.change_percent;
                const changePositive = change != null && change >= 0;

                return (
                  <div
                    key={item.stock.ticker}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-card-hover"
                  >
                    {/* Ticker */}
                    <div className="w-14">
                      <p className="mono text-sm font-bold text-text-primary">{item.stock.ticker}</p>
                    </div>

                    {/* Price */}
                    <div className="w-20 text-right">
                      <p className="mono text-sm font-medium text-text-primary">
                        {item.stock.price != null ? `$${Number(item.stock.price).toFixed(0)}` : "—"}
                      </p>
                    </div>

                    {/* Change */}
                    <div className="w-16 text-right">
                      {change != null ? (
                        <span className={`mono text-xs font-medium ${changePositive ? "text-green" : "text-red"}`}>
                          {changePositive ? "+" : ""}{(change * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </div>

                    {/* Verdict badge */}
                    <div className="flex-1">
                      {analysis?.verdict ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${verdictStyle}`}>
                          {analysis.verdict}
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-muted">—</span>
                      )}
                    </div>

                    {/* Open button */}
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="text-xs font-semibold text-accent-light transition-colors hover:text-accent"
                    >
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            !addLoading && (
              <div className="rounded-xl bg-surface px-5 py-10 text-center">
                <p className="text-sm text-text-muted">Your watchlist is empty.</p>
                <p className="mt-1 text-xs text-text-muted/70">
                  Add a stock above or pick from suggestions.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
