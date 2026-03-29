# Lucid ✦

**Invest with clarity.**

Lucid is a full-stack stock analysis platform that turns complex financial data into plain English. It combines real-time market data from EODHD with AI-powered insights from Google Gemini to give retail investors a clear, honest picture of any publicly traded US stock — complete with interactive charts, SEC filing intelligence, sector-aware metrics, and personalized investment advice.

Built for people who want to understand what they're buying, not just the ticker symbol.

## Features

### Dashboard
- **Suggested stocks** — Six curated picks across Large Cap (AAPL, MSFT), Growth (NVDA, AMZN), and Semiconductor/Value (JNJ, AMD), each with real-time price, quick stats, and a one-line AI description
- **Watchlist** — Add any US ticker via search, persisted in localStorage. Compact rows with price, quarterly growth, and AI verdict badges
- **One-click actions** — Every watchlist stock has Analysis, Compare, and Advice buttons

### Full Stock Analysis
Seven sections loaded in parallel, each independently retryable:

1. **Price History** — 1-year daily OHLCV area chart with volume bars. Green fill if up over the year, red if down. All data from EODHD, no estimates
2. **What They Do** — AI-generated 3-sentence company overview with finance terms auto-highlighted
3. **Key Metrics / Full Statistics** — Toggle between 6 AI-selected sector-relevant metrics (tech gets R&D spend, banks get NIM) and a full 32-metric statistics panel across 5 tabs: Valuation, Profitability, Income Statement, Balance Sheet, Cash Flow. Every metric has a plain-English tooltip
4. **Financial Trends** — 4-year line chart of Revenue, Net Income, and Free Cash Flow from EODHD annual financials
5. **SEC Filing Intelligence** — Pulls latest 10-K/10-Q from SEC EDGAR, sends to Gemini for structured extraction: business segments (revenue, operating income, margin, YoY change), geographic segments (revenue, % of total, YoY), management tone, key risks, and opportunities. Visualized with horizontal bar charts and data tables
6. **Latest News** — 5 recent headlines from EODHD news, each with AI-generated "what this means for you" in plain English and a sentiment indicator (green/grey/red dot)
7. **AI Verdict** — Color-coded verdict badge (Undervalued / Fair / Expensive but Growing / Overvalued) with reasoning

### Stock Comparison
Rich visual comparison between any two watchlist stocks:

- **Radar chart** — 5-dimension spider chart (Valuation, Growth, Profitability, Safety, Dividend), scores 0-100 from Gemini
- **Revenue history** — Grouped bar chart, last 4 years of annual revenue side by side
- **Margins comparison** — Horizontal bar chart comparing Gross, Operating, Net, and FCF margins
- **Metrics table** — P/E, EPS, Dividend Yield, Debt/Equity, Revenue Growth with better values highlighted green. Every metric name is a hoverable FinanceTerm
- **AI verdict** — "Choose X if you want growth" / "Choose Y if you want stability" with bullet-point reasoning

### Personalized Advice
Modal form collecting risk tolerance (Conservative/Moderate/Aggressive), time horizon, investable amount, and current holdings. Returns a BUY/HOLD/SELL recommendation with dollar amount, reasoning, 3 personalized risk factors, and an actionable next step.

### Finance Glossary
Floating book icon opens a slide-in drawer with 40+ finance terms defined in plain English, searchable and sorted A-Z. The `wrapFinanceTerms` utility auto-detects and wraps known terms in any AI-generated text throughout the app.

## Tech Stack

| Layer      | Technology                                             |
|------------|--------------------------------------------------------|
| Frontend   | React 19, Vite 8, Tailwind CSS v4                     |
| Charts     | Recharts (Area, Line, Bar, Radar)                      |
| Backend    | FastAPI, Python 3.12, Uvicorn                          |
| Market Data| EODHD API (fundamentals, EOD prices, news)             |
| SEC Data   | SEC EDGAR API (CIK lookup, 10-K/10-Q filings)         |
| AI         | Google Gemini Flash (analysis, comparison, advice)     |
| Caching    | In-memory (backend) + localStorage with 30min TTL (frontend) |

## Architecture

```
lucid/
├── backend/
│   ├── main.py              # FastAPI app — all endpoints
│   ├── requirements.txt
│   ├── .env.example
│   └── .env                 # Your API keys (gitignored)
├── frontend/
│   ├── src/
│   │   ├── api.js           # Axios client with localStorage caching
│   │   ├── App.jsx          # Router setup
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # Main page — suggestions + watchlist
│   │   │   └── Watchlist.jsx    # Legacy watchlist (unused)
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Navbar + main wrapper
│   │   │   ├── FullAnalysis.jsx # 7-section analysis modal
│   │   │   ├── CompareView.jsx  # Comparison page with charts
│   │   │   ├── AdviceForm.jsx   # Personalized advice modal
│   │   │   ├── StatisticsPanel.jsx  # 5-tab financial statistics
│   │   │   ├── SuggestionCard.jsx   # Dashboard stock card
│   │   │   ├── TickerCard.jsx       # Watchlist card (legacy)
│   │   │   ├── MetricCard.jsx       # Dynamic metric display
│   │   │   ├── NewsCard.jsx         # News article with sentiment
│   │   │   ├── FinanceTerm.jsx      # Tooltip component (portal-based)
│   │   │   ├── GlossaryDrawer.jsx   # Slide-in glossary
│   │   │   ├── Skeleton.jsx         # Loading skeletons
│   │   │   ├── ErrorCard.jsx        # Error state with retry
│   │   │   └── LoadingSpinner.jsx   # Pulsing spinner
│   │   ├── data/
│   │   │   └── financeTerms.js  # 40+ term definitions
│   │   └── utils/
│   │       └── wrapFinanceTerms.jsx  # Auto-wrap terms in text
│   ├── index.html
│   ├── .env.example
│   └── package.json
└── README.md
```

## API Endpoints

### Market Data (EODHD, no AI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stock/{ticker}` | Cleaned fundamentals: price, P/E, margins, revenue, FCF, sector |
| GET | `/api/suggestions` | 6 curated stocks with one-liner AI descriptions |
| GET | `/api/financials/{ticker}` | 4 years of revenue, net income, FCF |
| GET | `/api/ohlcv/{ticker}` | 1 year of daily OHLCV price data |
| GET | `/api/statistics/{ticker}` | 32 metrics across 5 categories with definitions |
| GET | `/api/compare-data/{t1}/{t2}` | 4 years of revenue for both tickers |
| GET | `/api/health/{ticker}` | Deterministic profitability/debt/growth scores (0-100) |

### AI-Powered (Gemini)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | AI analysis: what they do, metric explanations, verdict |
| POST | `/api/compare` | Radar scores, margins, table, verdict, pick recommendations |
| POST | `/api/advice` | Personalized BUY/HOLD/SELL with reasoning and risks |
| GET | `/api/metrics/{ticker}` | 6 sector-relevant metrics chosen by Gemini |
| GET | `/api/sec/{ticker}` | SEC filing intelligence: segments, geographic, risks |
| GET | `/api/news/{ticker}` | News headlines with plain-English AI analysis |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [EODHD API key](https://eodhd.com) (free tier available)
- [Google Gemini API key](https://aistudio.google.com/apikey) (free tier: ~20 requests/day per project)

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` with your keys:

```
EODHD_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

Start the server:

```bash
uvicorn main:app --reload
```

API runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173`.

Optionally create `frontend/.env` to override the API URL:

```
VITE_API_URL=http://localhost:8000
```

## Environment Variables

| Variable | Required | Where to get it | Notes |
|----------|----------|-----------------|-------|
| `EODHD_API_KEY` | Yes | [eodhd.com](https://eodhd.com) | Free tier supports fundamentals + EOD prices |
| `GEMINI_API_KEY` | Yes | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free tier: ~20 req/day. Create key in a **new project** for fresh quota |
| `VITE_API_URL` | No | — | Frontend API base URL, defaults to `http://localhost:8000` |

## Caching Strategy

Lucid caches aggressively at two layers to minimize API calls:

**Backend (in-memory, lives for server session):**
- `_eodhd_cache` — Raw EODHD fundamentals per ticker. Every endpoint that reads fundamentals shares this cache
- `_ohlcv_cache` — Daily price data per ticker
- `_suggestions_cache` — Assembled suggestions response
- `_description_cache` — Gemini one-liner descriptions
- `_analyze_cache` — Gemini analysis per ticker
- `_compare_cache` — Gemini comparison per ticker pair
- `_gemini_cache` — Metrics, SEC, news per ticker

**Frontend (localStorage, 30-minute TTL):**
- Every API call goes through `cached(key, fetcher)` in `api.js`
- Keys are scoped: `lucid_cache:stock:AAPL`, `lucid_cache:compare:NVDA:AMD`, etc.
- Second request for the same data returns instantly with zero network calls

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#EEF4FB` | Page background |
| `surface` | `#F7FAFD` | Section backgrounds |
| `card` | `#FFFFFF` | Card backgrounds |
| `border` | `#D6E4F0` | All borders |
| `accent` | `#2C5F8A` | Primary navy blue |
| `accent-light` | `#4A90C4` | Links, secondary accent |
| `accent-soft` | `#C8DFF0` | Soft fills, tags |
| `green` | `#2E7D5E` | Positive values, undervalued |
| `red` | `#C0392B` | Negative values, overvalued |
| `yellow` | `#B8860B` | Fair valuation, cautious tone |
| `purple` | `#5B4FCF` | Expensive but growing |

**Typography:**
- Headings: Playfair Display (serif)
- Body: Inter (sans-serif)
- Numbers/metrics: DM Mono (monospace)

**Cards:** White background, 1px border, 16px radius, subtle `rgba(44,95,138,0.06)` shadow. Hover lifts 4px with deeper shadow.

## Demo Flow

Follow these steps to see every feature:

1. **Dashboard** — Open `http://localhost:5173`. Six suggested stocks load with prices, quick stats, and AI descriptions
2. **Add to Watchlist** — Click "+ Add to Watchlist" on NVDA. It appears in the right-side watchlist with a verdict badge
3. **Full Analysis** — Click "Analysis" on the NVDA watchlist row. The modal opens with price chart, AI overview, dynamic metrics, financial trends, SEC filing data, and news
4. **Statistics** — In the analysis modal, click "All Statistics" to see 32 financial metrics across 5 tabbed categories. Hover any metric name for a plain-English tooltip
5. **Add second stock** — Close the modal. Add AMD to your watchlist (type AMD in the search bar or click "+ Add to Watchlist" on the suggestion card)
6. **Compare** — Click "Compare" on NVDA, then click the AMD row. View the radar chart, revenue bar chart, margins comparison, metrics table, and AI verdict
7. **Get Advice** — Click "Advice" on any watchlist stock. Fill in your investment amount ($5000), risk tolerance (Moderate), time horizon (5-10 years), and current holdings (VTI, QQQ). Click "Generate My Advice" for a personalized BUY/HOLD/SELL recommendation
8. **Glossary** — Click the book icon in the bottom-right corner. Browse or search 40+ finance terms with plain-English definitions

## Limitations

- EODHD free tier has rate limits. Paid plans unlock higher throughput
- Gemini free tier allows ~20 requests per day per project. Cached responses reduce this impact significantly. For higher limits, upgrade at Google AI Studio or create keys in new projects
- No real-time streaming prices — uses end-of-day and fundamental data
- No user accounts or server-side persistence. Watchlist and cache live in the browser's localStorage
- SEC filing extraction uses heuristic text parsing + Gemini. Some filings may not parse cleanly
- AI-generated analysis is informational and educational, not financial advice. Always do your own research

## License

MIT
