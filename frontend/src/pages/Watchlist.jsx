import { useState, useEffect } from "react";
import { fetchStock, analyzeStock, compareStocks } from "../api";
import TickerCard from "../components/TickerCard";
import FullAnalysis from "../components/FullAnalysis";
import CompareView from "../components/CompareView";
import AdviceForm from "../components/AdviceForm";
import LoadingSpinner from "../components/LoadingSpinner";

const STORAGE_KEY = "lucid_watchlist";
const EXAMPLE_TICKERS = ["AAPL", "MSFT", "TSLA"];

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

  async function addTicker(symbol) {
    const t = symbol.trim().toUpperCase();
    if (!t) return;

    if (watchlist.some((item) => item.stock.ticker === t)) {
      setError(`${t} is already in your watchlist`);
      return;
    }

    setLoading(true);
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
      const msg =
        err.response?.data?.detail || err.response?.data?.message || `Ticker "${t}" not found`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(e) {
    e.preventDefault();
    addTicker(ticker);
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
        <div className="card-base mb-6 flex items-center justify-between border-accent/20 bg-accent-soft/20 px-5 py-3">
          <p className="text-sm text-accent">
            Select another stock to compare with{" "}
            <span className="mono font-bold">{compareSource.stock.ticker}</span>
          </p>
          <button
            onClick={handleCancelCompare}
            className="text-xs font-medium text-text-muted transition-colors hover:text-red"
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
          className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-sm text-text-primary shadow-[var(--shadow-card)] placeholder-text-muted outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-px hover:shadow-lg disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Error toast */}
      {error && (
        <div className="mb-6 card-base border-red/20 bg-red/5 px-4 py-3 text-sm text-red">
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
                analysis={item.analysis?._error ? null : item.analysis}
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
              className="rounded-full border border-border px-5 py-2 text-sm text-text-muted transition-all hover:-translate-y-px hover:border-red/40 hover:text-red"
            >
              Clear watchlist
            </button>
          </div>
        </>
      ) : (
        !loading && (
          <div className="flex flex-col items-center py-24">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft/40">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <p className="heading text-lg font-bold text-text-primary">Add a ticker to get started</p>
            <p className="mt-1 text-sm text-text-muted">
              Search for a stock above or try one of these
            </p>
            <div className="mt-5 flex gap-2">
              {EXAMPLE_TICKERS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTicker(t); addTicker(t); }}
                  className="mono card-base px-4 py-2 text-sm font-medium text-accent transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-light/50 hover:shadow-[var(--shadow-card-hover)]"
                >
                  Try {t}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
