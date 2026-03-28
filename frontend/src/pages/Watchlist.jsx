import { useState, useEffect } from "react";
import { fetchStock, analyzeStock, compareStocks } from "../api";
import TickerCard from "../components/TickerCard";
import FullAnalysis from "../components/FullAnalysis";
import CompareView from "../components/CompareView";
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

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [adviceItem, setAdviceItem] = useState(null);

  // Compare state
  const [compareSource, setCompareSource] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState(null);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

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

  function handleClear() {
    setWatchlist([]);
  }

  function handleCompareStart(item) {
    if (watchlist.length < 2) {
      setError("Add at least 2 stocks to compare");
      return;
    }
    setCompareSource(item);
  }

  function handleCancelCompare() {
    setCompareSource(null);
  }

  async function handleCompareSelect(item) {
    if (!compareSource) return;
    setCompareLoading(true);
    try {
      const result = await compareStocks(
        compareSource.stock.ticker,
        item.stock.ticker,
      );
      setCompareResult({
        stock1: compareSource.stock,
        stock2: item.stock,
        comparison: result,
      });
    } catch (err) {
      const msg =
        err.response?.data?.detail || err.response?.data?.message || "Comparison failed";
      setError(msg);
    } finally {
      setCompareLoading(false);
      setCompareSource(null);
    }
  }

  function handleBackFromCompare() {
    setCompareResult(null);
  }

  // --- Full-page compare result ---
  if (compareResult) {
    return (
      <CompareView
        stock1={compareResult.stock1}
        stock2={compareResult.stock2}
        comparison={compareResult.comparison}
        onBack={handleBackFromCompare}
      />
    );
  }

  // --- Compare loading ---
  if (compareLoading) {
    return <LoadingSpinner message="Comparing stocks with AI..." />;
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

      {/* Compare mode banner */}
      {compareSource && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-5 py-3">
          <p className="text-sm text-accent">
            Select another stock to compare with{" "}
            <span className="font-bold">{compareSource.stock.ticker}</span>
          </p>
          <button
            onClick={handleCancelCompare}
            className="text-xs text-text-muted transition-colors hover:text-accent-red"
          >
            Cancel
          </button>
        </div>
      )}

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
                onViewFull={() => setSelectedItem(item)}
                onCompare={() => handleCompareStart(item)}
                onAdvice={() => setAdviceItem(item)}
                compareMode={!!compareSource}
                isCompareSource={compareSource?.stock.ticker === item.stock.ticker}
                onSelect={() => handleCompareSelect(item)}
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
