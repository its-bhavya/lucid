import { useState, useEffect } from "react";
import { fetchStock, analyzeStock } from "../api";
import TickerCard from "../components/TickerCard";
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

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  // Auto-dismiss error toast
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  async function handleAdd(e) {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;

    if (watchlist.some((item) => item.stock.ticker === t)) {
      setError(`${t} is already in your watchlist`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const stock = await fetchStock(t);
      const analysis = await analyzeStock(stock);
      setWatchlist((prev) => [{ stock, analysis }, ...prev]);
      setTicker("");
    } catch (err) {
      const msg =
        err.response?.data?.detail || err.response?.data?.message || "Ticker not found";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleRemove(tickerSymbol) {
    setWatchlist((prev) => prev.filter((item) => item.stock.ticker !== tickerSymbol));
  }

  function handleClear() {
    setWatchlist([]);
  }

  return (
    <div>
      {/* Search bar */}
      <form onSubmit={handleAdd} className="mb-8 flex gap-3">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Enter ticker symbol (e.g. AAPL)"
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Error toast */}
      {error && (
        <div className="mb-6 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && <LoadingSpinner message="Fetching stock data & AI analysis..." />}

      {/* Watchlist grid */}
      {watchlist.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {watchlist.map((item) => (
              <TickerCard
                key={item.stock.ticker}
                stock={item.stock}
                analysis={item.analysis}
                onViewFull={() => {}}
                onCompare={() => {}}
                onAdvice={() => {}}
              />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleClear}
              className="rounded-lg border border-border px-5 py-2 text-sm text-text-muted transition-colors hover:border-accent-red hover:text-accent-red"
            >
              Clear watchlist
            </button>
          </div>
        </>
      ) : (
        !loading && (
          <div className="py-20 text-center">
            <p className="text-lg text-text-muted">Your watchlist is empty</p>
            <p className="mt-1 text-sm text-text-muted/60">
              Search for a ticker above to get started
            </p>
          </div>
        )
      )}
    </div>
  );
}
