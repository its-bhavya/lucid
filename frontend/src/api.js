import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`lucid_cache:${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(`lucid_cache:${key}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(`lucid_cache:${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage full — ignore
  }
}

async function cached(key, fetcher) {
  const hit = cacheGet(key);
  if (hit) return hit;
  const data = await fetcher();
  cacheSet(key, data);
  return data;
}

export async function fetchStock(ticker) {
  return cached(`stock:${ticker}`, async () => {
    const { data } = await api.get(`/api/stock/${ticker}`);
    return data;
  });
}

export async function analyzeStock(stockData) {
  const ticker = stockData.ticker || "";
  return cached(`analyze:${ticker}`, async () => {
    const { data } = await api.post("/api/analyze", { stock_data: stockData });
    return data;
  });
}

export async function compareStocks(ticker1, ticker2) {
  return cached(`compare:${ticker1}:${ticker2}`, async () => {
    const { data } = await api.post("/api/compare", { ticker1, ticker2 });
    return data;
  });
}

export async function fetchSuggestions() {
  return cached("suggestions", async () => {
    const { data } = await api.get("/api/suggestions");
    return data;
  });
}

export async function getAdvice(stockData, profile) {
  // Advice is personalized per profile — cache by ticker + profile hash
  const key = `advice:${stockData.ticker}:${profile.risk_level}:${profile.investable_amount}:${profile.time_horizon}`;
  return cached(key, async () => {
    const { data } = await api.post("/api/advice", { stock_data: stockData, profile });
    return data;
  });
}

export async function fetchCompareData(ticker1, ticker2) {
  return cached(`compare-data:${ticker1}:${ticker2}`, async () => {
    const { data } = await api.get(`/api/compare-data/${ticker1}/${ticker2}`);
    return data;
  });
}

export async function fetchMetrics(ticker) {
  return cached(`metrics:${ticker}`, async () => {
    const { data } = await api.get(`/api/metrics/${ticker}`);
    return data;
  });
}

export async function fetchFinancials(ticker) {
  return cached(`financials:${ticker}`, async () => {
    const { data } = await api.get(`/api/financials/${ticker}`);
    return data;
  });
}

export async function fetchOhlcv(ticker) {
  return cached(`ohlcv:${ticker}`, async () => {
    const { data } = await api.get(`/api/ohlcv/${ticker}`);
    return data;
  });
}

export async function fetchStatistics(ticker) {
  return cached(`statistics:${ticker}`, async () => {
    const { data } = await api.get(`/api/statistics/${ticker}`);
    return data;
  });
}

export async function fetchSec(ticker) {
  return cached(`sec:${ticker}`, async () => {
    const { data } = await api.get(`/api/sec/${ticker}`);
    return data;
  });
}

export async function fetchNews(ticker) {
  return cached(`news:${ticker}`, async () => {
    const { data } = await api.get(`/api/news/${ticker}`);
    return data;
  });
}
