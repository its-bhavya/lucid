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

export async function getAdvice(stockData, profile) {
  const { data } = await api.post("/api/advice", { stock_data: stockData, profile });
  return data;
}
