import asyncio
import json
import os

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

EODHD_API_KEY = os.getenv("EODHD_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ANALYZE_PROMPT = """\
Given these stock fundamentals, return a JSON object with exactly these keys:
- what_they_do: 2 sentence plain English description of the company
- pe_explanation: explain the P/E ratio in 1 sentence like the user is 10 years old
- fcf_explanation: explain free cash flow in 1 sentence simply
- health_summary: array of 3 objects each with {icon: "✓" or "⚠", text: string}
- verdict: one of "UNDERVALUED", "FAIR VALUATION", "EXPENSIVE BUT GROWING", "OVERVALUED"
- verdict_reason: 1-2 sentence explanation of the verdict

Return ONLY valid JSON, no markdown or backticks.

Stock data:
"""


COMPARE_PROMPT = """\
Compare these two stocks. Return a JSON object with exactly these keys:
- table: array of {{ metric, stock1_value, stock2_value }} for P/E, EPS, Dividend Yield, Debt/Equity, Revenue Growth
- radar: {{ stock1: {{ valuation, growth, profitability, safety, dividend }}, stock2: {{ valuation, growth, profitability, safety, dividend }} }} — each a score 0-100
- margins: {{ stock1: {{ gross_margin, operating_margin, net_margin, fcf_margin }}, stock2: {{ gross_margin, operating_margin, net_margin, fcf_margin }} }} — each a percentage number (e.g. 27.5)
- verdict: 2-3 sentence plain English comparison
- pick_if_growth: {{ ticker: string, reasons: array of 2-3 short strings }}
- pick_if_stability: {{ ticker: string, reasons: array of 2-3 short strings }}

Return ONLY valid JSON, no markdown or backticks.

Stock 1:
{stock1}

Stock 2:
{stock2}
"""

ADVICE_PROMPT = """\
Given this stock and investor profile, return a JSON object with exactly these keys:
- recommendation: one of BUY, HOLD, SELL
- amount: suggested dollar amount to invest (number)
- reasoning: 2-3 sentence why this fits their profile
- risks: array of 3 short risk strings specific to their situation
- next_step: 1 sentence actionable next step

Return ONLY valid JSON, no markdown or backticks.

Stock data:
{stock_data}

Investor profile:
{profile}
"""


class AnalyzeRequest(BaseModel):
    stock_data: dict


class CompareRequest(BaseModel):
    ticker1: str
    ticker2: str


class InvestorProfile(BaseModel):
    income: float | None = None
    investable_amount: float | None = None
    risk_level: str | None = None
    time_horizon: str | None = None
    current_holdings: str | None = None


class AdviceRequest(BaseModel):
    stock_data: dict
    profile: InvestorProfile


@app.get("/")
async def root():
    return {"message": "Lucid backend running"}


def _latest_financial(data: dict, sheet: str, field: str):
    yearly = data.get("Financials", {}).get(sheet, {}).get("yearly", {})
    if not yearly:
        return None
    latest = next(iter(yearly.values()))
    return latest.get(field)


async def _ask_gemini(prompt: str) -> dict:
    """Send a prompt to Gemini and return parsed JSON."""
    try:
        model = genai.GenerativeModel("gemini-flash-latest")
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0].strip()
        return json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gemini returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")


async def _fetch_raw_fundamentals(ticker: str) -> dict:
    """Fetch raw EODHD fundamentals JSON for a ticker."""
    url = f"https://eodhd.com/api/fundamentals/{ticker}.US"
    params = {"api_token": EODHD_API_KEY, "fmt": "json"}
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=20)
    if resp.status_code == 401:
        raise HTTPException(status_code=500, detail="EODHD API key is invalid or missing")
    try:
        data = resp.json()
    except Exception:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")
    if resp.status_code != 200 or not isinstance(data, dict) or not data.get("General"):
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")
    return data


async def _fetch_stock_data(ticker: str) -> dict:
    """Fetch and clean stock data from EODHD for a single ticker."""
    data = await _fetch_raw_fundamentals(ticker)
    general = data.get("General", {})
    highlights = data.get("Highlights", {})
    description = general.get("Description", "") or ""

    return {
        "name": general.get("Name"),
        "ticker": general.get("Code"),
        "currency": general.get("CurrencyCode"),
        "sector": general.get("Sector"),
        "price": highlights.get("WallStreetTargetPrice"),
        "change_percent": highlights.get("QuarterlyRevenueGrowthYOY"),
        "pe_ratio": highlights.get("PERatio"),
        "eps": highlights.get("EarningsShare"),
        "dividend_yield": highlights.get("DividendYield"),
        "profit_margin": highlights.get("ProfitMargin"),
        "operating_margin": highlights.get("OperatingMarginTTM"),
        "revenue": highlights.get("RevenueTTM"),
        "total_debt": _latest_financial(data, "Balance_Sheet", "shortLongTermDebtTotal"),
        "free_cash_flow": _latest_financial(data, "Cash_Flow", "freeCashFlow"),
        "description": description[:300],
    }


SUGGESTION_TICKERS = [
    {"ticker": "AAPL", "category": "Large Cap"},
    {"ticker": "MSFT", "category": "Large Cap"},
    {"ticker": "NVDA", "category": "Growth"},
    {"ticker": "AMZN", "category": "Growth"},
    {"ticker": "JNJ", "category": "Value / Dividend"},
    {"ticker": "KO", "category": "Value / Dividend"},
]

ONELINER_PROMPT = """\
For each stock below, write a single sentence (max 15 words) describing what the company does in plain English. Return a JSON object mapping ticker to the sentence. No markdown.

Stocks: {tickers}
"""

# In-memory cache for one-liner descriptions
_description_cache: dict[str, str] = {}


@app.get("/api/stock/{ticker}")
async def get_stock(ticker: str):
    return await _fetch_stock_data(ticker)


@app.get("/api/suggestions")
async def get_suggestions():
    tickers = [s["ticker"] for s in SUGGESTION_TICKERS]
    category_map = {s["ticker"]: s["category"] for s in SUGGESTION_TICKERS}

    # Fetch all stocks in parallel
    results = await asyncio.gather(
        *[_fetch_stock_data(t) for t in tickers],
        return_exceptions=True,
    )

    stocks = []
    valid_tickers = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            continue
        r["category"] = category_map[tickers[i]]
        stocks.append(r)
        valid_tickers.append(tickers[i])

    # Get one-liner AI descriptions (cached)
    uncached = [t for t in valid_tickers if t not in _description_cache]
    if uncached:
        try:
            prompt = ONELINER_PROMPT.format(tickers=", ".join(uncached))
            descs = await _ask_gemini(prompt)
            for t, desc in descs.items():
                _description_cache[t.upper()] = desc
        except Exception:
            pass  # Fall back to truncated description

    for s in stocks:
        s["one_liner"] = _description_cache.get(s["ticker"], s.get("description", "")[:80])

    return stocks


_analyze_cache: dict[str, dict] = {}


@app.post("/api/analyze")
async def analyze_stock(req: AnalyzeRequest):
    ticker = req.stock_data.get("ticker", "")
    if ticker and ticker in _analyze_cache:
        return JSONResponse(content=_analyze_cache[ticker], media_type="application/json; charset=utf-8")
    prompt = ANALYZE_PROMPT + json.dumps(req.stock_data, indent=2)
    result = await _ask_gemini(prompt)
    if ticker:
        _analyze_cache[ticker] = result
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


_compare_cache: dict[str, dict] = {}


@app.post("/api/compare")
async def compare_stocks(req: CompareRequest):
    cache_key = f"{req.ticker1.upper()}:{req.ticker2.upper()}"
    if cache_key in _compare_cache:
        return JSONResponse(content=_compare_cache[cache_key], media_type="application/json; charset=utf-8")

    results = await asyncio.gather(
        _fetch_stock_data(req.ticker1),
        _fetch_stock_data(req.ticker2),
        return_exceptions=True,
    )
    for r in results:
        if isinstance(r, HTTPException):
            raise r
        if isinstance(r, Exception):
            raise HTTPException(status_code=500, detail=str(r))
    stock1, stock2 = results
    prompt = COMPARE_PROMPT.format(
        stock1=json.dumps(stock1, indent=2),
        stock2=json.dumps(stock2, indent=2),
    )
    result = await _ask_gemini(prompt)
    _compare_cache[cache_key] = result
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


def _extract_revenue_history(raw_data: dict) -> list:
    """Extract last 4 years of annual revenue from raw EODHD data."""
    income = raw_data.get("Financials", {}).get("Income_Statement", {}).get("yearly", {})
    years = []
    for date_key, row in list(income.items())[:4]:
        years.append({
            "year": date_key[:4],
            "revenue": float(row.get("totalRevenue") or 0),
        })
    years.reverse()
    return years


@app.get("/api/compare-data/{ticker1}/{ticker2}")
async def get_compare_data(ticker1: str, ticker2: str):
    """Return historical revenue for both tickers for charts."""
    raw1, raw2 = await asyncio.gather(
        _fetch_raw_fundamentals(ticker1),
        _fetch_raw_fundamentals(ticker2),
    )
    rev1 = _extract_revenue_history(raw1)
    rev2 = _extract_revenue_history(raw2)

    # Merge into chart-friendly format
    years_set = sorted({r["year"] for r in rev1 + rev2})
    rev1_map = {r["year"]: r["revenue"] for r in rev1}
    rev2_map = {r["year"]: r["revenue"] for r in rev2}

    chart_data = []
    for y in years_set:
        chart_data.append({
            "year": y,
            "stock1_revenue": rev1_map.get(y, 0),
            "stock2_revenue": rev2_map.get(y, 0),
        })

    return chart_data


@app.post("/api/advice")
async def get_advice(req: AdviceRequest):
    prompt = ADVICE_PROMPT.format(
        stock_data=json.dumps(req.stock_data, indent=2),
        profile=json.dumps(req.profile.model_dump(), indent=2),
    )
    result = await _ask_gemini(prompt)
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


# ---------------------------------------------------------------------------
# Dynamic metrics endpoint
# ---------------------------------------------------------------------------
METRICS_PROMPT = """\
Given these fundamentals for {ticker} in the {sector} sector, select the 6 most \
relevant metrics an investor should know. For a bank, include NIM and Tier 1 Capital. \
For a tech company, include R&D spend and ARR growth. For a retailer, include \
same-store sales and inventory turnover. Return a JSON array of 6 objects:
{{ "metric_name": string, "value": string, "unit": string, \
"trend": "up"|"down"|"neutral", "finance_term_definition": string, \
"why_it_matters": string }}

Return ONLY valid JSON, no markdown or backticks.

Fundamentals:
{fundamentals}
"""


_gemini_cache: dict[str, dict | list] = {}


@app.get("/api/metrics/{ticker}")
async def get_metrics(ticker: str):
    cache_key = f"metrics:{ticker.upper()}"
    if cache_key in _gemini_cache:
        return JSONResponse(content=_gemini_cache[cache_key], media_type="application/json; charset=utf-8")
    data = await _fetch_raw_fundamentals(ticker)
    sector = data.get("General", {}).get("Sector", "Unknown")
    highlights = data.get("Highlights", {})
    prompt = METRICS_PROMPT.format(
        ticker=ticker,
        sector=sector,
        fundamentals=json.dumps(highlights, indent=2),
    )
    result = await _ask_gemini(prompt)
    _gemini_cache[cache_key] = result
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


# ---------------------------------------------------------------------------
# Historical financials for charts
# ---------------------------------------------------------------------------
@app.get("/api/financials/{ticker}")
async def get_financials(ticker: str):
    data = await _fetch_raw_fundamentals(ticker)
    income = data.get("Financials", {}).get("Income_Statement", {}).get("yearly", {})
    cashflow = data.get("Financials", {}).get("Cash_Flow", {}).get("yearly", {})

    years = []
    for date_key, row in list(income.items())[:4]:
        year = date_key[:4]
        cf_row = cashflow.get(date_key, {})
        years.append({
            "year": year,
            "revenue": float(row.get("totalRevenue") or 0),
            "net_income": float(row.get("netIncome") or 0),
            "free_cash_flow": float(cf_row.get("freeCashFlow") or 0),
        })

    years.reverse()  # oldest first for chart
    return years


# ---------------------------------------------------------------------------
# Health scores
# ---------------------------------------------------------------------------
HEALTH_PROMPT = """\
Given these stock fundamentals, compute three health scores from 0 to 100:
- profitability_score (based on profit margin, ROE, operating margin)
- debt_safety_score (based on debt-to-equity, interest coverage, current ratio)
- growth_score (based on revenue growth, earnings growth, FCF growth)

Return a JSON object with exactly these three keys, each an integer 0-100.
Return ONLY valid JSON, no markdown or backticks.

Fundamentals:
{fundamentals}
"""


@app.get("/api/health/{ticker}")
async def get_health(ticker: str):
    cache_key = f"health:{ticker.upper()}"
    if cache_key in _gemini_cache:
        return JSONResponse(content=_gemini_cache[cache_key], media_type="application/json; charset=utf-8")
    data = await _fetch_raw_fundamentals(ticker)
    highlights = data.get("Highlights", {})
    prompt = HEALTH_PROMPT.format(fundamentals=json.dumps(highlights, indent=2))
    result = await _ask_gemini(prompt)
    _gemini_cache[cache_key] = result
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


# ---------------------------------------------------------------------------
# Revenue segments (for pie chart)
# ---------------------------------------------------------------------------
@app.get("/api/segments/{ticker}")
async def get_segments(ticker: str):
    cache_key = f"segments:{ticker.upper()}"
    if cache_key in _gemini_cache:
        return JSONResponse(content=_gemini_cache[cache_key], media_type="application/json; charset=utf-8")
    data = await _fetch_raw_fundamentals(ticker)
    general = data.get("General", {})
    sector = general.get("Sector", "Unknown")

    prompt = (
        f"Based on your knowledge of {general.get('Name', ticker)} ({ticker}) in the "
        f"{sector} sector, estimate their revenue breakdown by business segment. "
        "Return a JSON array of objects: {\"segment\": string, \"percent\": number}. "
        "Percentages must add to 100. Use 3-6 segments. "
        "Return ONLY valid JSON, no markdown or backticks."
    )
    result = await _ask_gemini(prompt)
    _gemini_cache[cache_key] = result
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


# ---------------------------------------------------------------------------
# SEC filings intelligence
# ---------------------------------------------------------------------------
SEC_HEADERS = {"User-Agent": "Lucid contact@lucid.app", "Accept-Encoding": "gzip, deflate"}


@app.get("/api/sec/{ticker}")
async def get_sec_intelligence(ticker: str):
    cache_key = f"sec:{ticker.upper()}"
    if cache_key in _gemini_cache:
        return JSONResponse(content=_gemini_cache[cache_key], media_type="application/json; charset=utf-8")
    async with httpx.AsyncClient(timeout=15) as client:
        # Step 1: look up CIK
        search_resp = await client.get(
            "https://efts.sec.gov/LATEST/search-index",
            params={"q": ticker, "dateRange": "custom", "startdt": "2024-01-01"},
            headers=SEC_HEADERS,
        )

        cik = None
        if search_resp.status_code == 200:
            try:
                hits = search_resp.json().get("hits", {}).get("hits", [])
                for hit in hits:
                    src = hit.get("_source", {})
                    if src.get("tickers") and ticker.upper() in [t.upper() for t in src["tickers"]]:
                        cik = src.get("ciks", [None])[0]
                        break
            except Exception:
                pass

        # Fallback: use EODHD general data for CIK
        if not cik:
            try:
                raw = await _fetch_raw_fundamentals(ticker)
                cik = raw.get("General", {}).get("CIK")
            except Exception:
                pass

        filing_text = ""
        filing_date = None

        if cik:
            padded = str(cik).zfill(10)
            sub_resp = await client.get(
                f"https://data.sec.gov/submissions/CIK{padded}.json",
                headers=SEC_HEADERS,
            )
            if sub_resp.status_code == 200:
                filings = sub_resp.json().get("filings", {}).get("recent", {})
                forms = filings.get("form", [])
                accessions = filings.get("accessionNumber", [])
                dates = filings.get("filingDate", [])
                primary_docs = filings.get("primaryDocument", [])

                for i, form in enumerate(forms):
                    if form in ("10-K", "10-Q"):
                        filing_date = dates[i] if i < len(dates) else None
                        acc = accessions[i].replace("-", "") if i < len(accessions) else None
                        doc = primary_docs[i] if i < len(primary_docs) else None
                        if acc and doc:
                            doc_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{doc}"
                            try:
                                doc_resp = await client.get(doc_url, headers=SEC_HEADERS)
                                if doc_resp.status_code == 200:
                                    raw_text = doc_resp.text
                                    # Extract MD&A-like section (rough heuristic)
                                    lower = raw_text.lower()
                                    start = lower.find("management")
                                    if start == -1:
                                        start = 0
                                    filing_text = raw_text[start:start + 5000]
                            except Exception:
                                pass
                        break

    if not filing_text:
        # Fallback: use Gemini's training knowledge
        filing_text = f"No SEC filing text available. Use your knowledge of {ticker}."

    prompt = (
        f"From this MD&A excerpt for {ticker}, extract:\n"
        "- segment_kpis: array of {{ segment, kpi_name, value, yoy_change, definition }}\n"
        "- management_tone: positive/neutral/cautious\n"
        "- key_risks: array of 3 strings\n"
        "- key_opportunities: array of 3 strings\n"
        "Return ONLY valid JSON, no markdown or backticks.\n\n"
        f"Filing date: {filing_date or 'unknown'}\n"
        f"Text:\n{filing_text[:4000]}"
    )
    result = await _ask_gemini(prompt)
    if filing_date:
        result["filing_date"] = filing_date
    _gemini_cache[cache_key] = result
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


# ---------------------------------------------------------------------------
# News with AI analysis
# ---------------------------------------------------------------------------
@app.get("/api/news/{ticker}")
async def get_news(ticker: str):
    cache_key = f"news:{ticker.upper()}"
    if cache_key in _gemini_cache:
        return JSONResponse(content=_gemini_cache[cache_key], media_type="application/json; charset=utf-8")
    url = "https://eodhd.com/api/news"
    params = {"s": f"{ticker}.US", "limit": 5, "api_token": EODHD_API_KEY, "fmt": "json"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)

    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch news")

    try:
        articles = resp.json()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse news")

    if not isinstance(articles, list) or not articles:
        return []

    headlines = [a.get("title", "") for a in articles]
    prompt = (
        f"For each headline about {ticker}, write one sentence explaining what it means "
        "for a retail investor who owns this stock. Also classify sentiment as "
        "positive, neutral, or negative.\n"
        "Return a JSON array of objects: "
        '{{ "plain_english_meaning": string, "sentiment": "positive"|"neutral"|"negative" }}\n'
        "Return ONLY valid JSON, no markdown or backticks.\n\n"
        f"Headlines:\n" + "\n".join(f"{i+1}. {h}" for i, h in enumerate(headlines))
    )

    try:
        meanings = await _ask_gemini(prompt)
    except Exception:
        meanings = [{"plain_english_meaning": "", "sentiment": "neutral"}] * len(articles)

    result = []
    for i, article in enumerate(articles):
        m = meanings[i] if i < len(meanings) else {}
        result.append({
            "headline": article.get("title", ""),
            "source": article.get("source", ""),
            "date": article.get("date", ""),
            "url": article.get("link", ""),
            "plain_english_meaning": m.get("plain_english_meaning", ""),
            "sentiment": m.get("sentiment", "neutral"),
        })

    _gemini_cache[cache_key] = result
    return result
