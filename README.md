# Lucid ✦

**Invest with clarity.**

Lucid is a full-stack stock analysis app that translates complex financial data into plain English. It fetches real-time fundamentals, runs them through Google Gemini, and returns clear verdicts, side-by-side comparisons, and personalized investment advice — all in seconds. Built for retail investors who want to understand what they're buying, not just the ticker symbol.

## Features

- **Add ticker, get instant AI summary** — Search any US stock and receive a plain-English breakdown of what the company does, how healthy it is, and whether it's fairly valued.
- **Full analysis with explained metrics** — P/E ratio, free cash flow, and profit margin explained like you're ten, not like you have a Bloomberg terminal.
- **Side-by-side stock comparison** — Compare two stocks across P/E, growth, margins, debt, and dividends with an AI-generated verdict and pick recommendations.
- **Personalized BUY / HOLD / SELL advice** — Enter your risk tolerance, time horizon, and current holdings. Gemini tailors a recommendation to your specific situation.

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 19 (Vite), Tailwind CSS v4  |
| Backend  | FastAPI, Python 3.12, Uvicorn     |
| Data     | EODHD API (real-time fundamentals) |
| AI       | Google Gemini Flash                |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- An [EODHD](https://eodhd.com) API key
- A [Google Gemini](https://aistudio.google.com) API key

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and fill in your API keys, then start the server:

```bash
uvicorn main:app --reload
```

The API runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

## Environment Variables

| Variable         | Required | Where to get it                                      |
|------------------|----------|------------------------------------------------------|
| `EODHD_API_KEY`  | Yes      | [eodhd.com](https://eodhd.com) — free tier available |
| `GEMINI_API_KEY`  | Yes      | [aistudio.google.com](https://aistudio.google.com)   |

## How It Works

1. You add a ticker symbol.
2. Lucid fetches live fundamentals from the EODHD API.
3. Gemini translates the numbers into a plain-English analysis.
4. You get a verdict and personalized advice in seconds.

## Demo Flow

Follow these steps to see every feature:

1. Open `http://localhost:5173`. Click **Try AAPL** or type `AAPL` and click **Add**.
2. A card appears with Apple's price, P/E ratio, dividend yield, and an AI verdict badge. Hover over the P/E ratio to see the plain-English tooltip.
3. Click **View Full** to open the full analysis modal — company description, explained metrics, health indicators, and verdict.
4. Close the modal. Add a second stock: type `MSFT` and click **Add**.
5. Click **Compare** on the AAPL card, then click the MSFT card. A side-by-side comparison loads with a table, verdict, and growth vs. stability picks.
6. Go back to the watchlist. Click **Get Advice** on any card. Fill in your investment amount, risk tolerance, time horizon, and current holdings. Click **Generate My Advice** to receive a personalized BUY/HOLD/SELL recommendation with reasoning, risks, and a next step.

## Limitations

- No real-time price charts or historical price data — fundamentals only.
- No user accounts or persistent server-side storage. Watchlist lives in localStorage.
- Gemini free tier is limited to approximately 150 requests per day.
- AI-generated analysis is informational, not financial advice.

## License

MIT
