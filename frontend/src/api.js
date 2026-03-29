import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

export async function fetchStock(ticker) {
  const { data } = await api.get(`/api/stock/${ticker}`);
  return data;
}

export async function analyzeStock(stockData) {
  const { data } = await api.post("/api/analyze", { stock_data: stockData });
  return data;
}

export async function compareStocks(ticker1, ticker2) {
  const { data } = await api.post("/api/compare", { ticker1, ticker2 });
  return data;
}

export async function fetchSuggestions() {
  const { data } = await api.get("/api/suggestions");
  return data;
}

export async function getAdvice(stockData, profile) {
  const { data } = await api.post("/api/advice", { stock_data: stockData, profile });
  return data;
}

export async function fetchCompareData(ticker1, ticker2) {
  const { data } = await api.get(`/api/compare-data/${ticker1}/${ticker2}`);
  return data;
}

export async function fetchMetrics(ticker) {
  const { data } = await api.get(`/api/metrics/${ticker}`);
  return data;
}

export async function fetchFinancials(ticker) {
  const { data } = await api.get(`/api/financials/${ticker}`);
  return data;
}

export async function fetchHealth(ticker) {
  const { data } = await api.get(`/api/health/${ticker}`);
  return data;
}

export async function fetchSegments(ticker) {
  const { data } = await api.get(`/api/segments/${ticker}`);
  return data;
}

export async function fetchSec(ticker) {
  const { data } = await api.get(`/api/sec/${ticker}`);
  return data;
}

export async function fetchNews(ticker) {
  const { data } = await api.get(`/api/news/${ticker}`);
  return data;
}
