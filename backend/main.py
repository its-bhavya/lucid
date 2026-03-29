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
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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


_eodhd_cache: dict[str, dict] = {}


async def _fetch_raw_fundamentals(ticker: str) -> dict:
    """Fetch raw EODHD fundamentals JSON for a ticker (cached)."""
    cache_key = ticker.upper()
    if cache_key in _eodhd_cache:
        return _eodhd_cache[cache_key]

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
    _eodhd_cache[cache_key] = data
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
    {"ticker": "AMD", "category": "Growth / Semiconductor"},
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


_suggestions_cache: list | None = None


@app.get("/api/suggestions")
async def get_suggestions():
    global _suggestions_cache
    if _suggestions_cache is not None:
        return _suggestions_cache

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

    _suggestions_cache = stocks
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


_ohlcv_cache: dict[str, list] = {}


@app.get("/api/ohlcv/{ticker}")
async def get_ohlcv(ticker: str):
    """Return 1 year of daily OHLCV data from EODHD."""
    cache_key = ticker.upper()
    if cache_key in _ohlcv_cache:
        return _ohlcv_cache[cache_key]

    from datetime import date, timedelta
    today = date.today()
    one_year_ago = today - timedelta(days=365)

    url = f"https://eodhd.com/api/eod/{ticker}.US"
    params = {
        "api_token": EODHD_API_KEY,
        "fmt": "json",
        "period": "d",
        "from": one_year_ago.isoformat(),
        "to": today.isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, params=params)
    except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.TimeoutException):
        raise HTTPException(status_code=500, detail="Price data request timed out.")

    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch price data")

    try:
        data = resp.json()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse price data")

    if not isinstance(data, list):
        raise HTTPException(status_code=404, detail="No price data available")

    result = [
        {
            "date": d["date"],
            "open": d["open"],
            "high": d["high"],
            "low": d["low"],
            "close": d["adjusted_close"],
            "volume": d["volume"],
        }
        for d in data
    ]

    _ohlcv_cache[cache_key] = result
    return result


@app.get("/api/statistics/{ticker}")
async def get_statistics(ticker: str):
    """Return organized financial statistics from EODHD. No Gemini, all real data."""
    data = await _fetch_raw_fundamentals(ticker)
    h = data.get("Highlights", {})
    v = data.get("Valuation", {})
    bs_yearly = data.get("Financials", {}).get("Balance_Sheet", {}).get("yearly", {})
    cf_yearly = data.get("Financials", {}).get("Cash_Flow", {}).get("yearly", {})
    inc_yearly = data.get("Financials", {}).get("Income_Statement", {}).get("yearly", {})
    bs = next(iter(bs_yearly.values()), {}) if bs_yearly else {}
    cf = next(iter(cf_yearly.values()), {}) if cf_yearly else {}
    inc = next(iter(inc_yearly.values()), {}) if inc_yearly else {}

    def f(val):
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    return {
        "valuation": [
            {"name": "Trailing P/E", "value": f(v.get("TrailingPE")), "fmt": "ratio", "definition": "Current price divided by last 12 months earnings. Shows how much you pay per dollar of profit."},
            {"name": "Forward P/E", "value": f(v.get("ForwardPE")), "fmt": "ratio", "definition": "Current price divided by estimated future earnings. Lower means cheaper relative to expected growth."},
            {"name": "PEG Ratio", "value": f(h.get("PEGRatio")), "fmt": "ratio", "definition": "P/E divided by earnings growth rate. Under 1 suggests the stock may be undervalued for its growth."},
            {"name": "Price/Sales", "value": f(v.get("PriceSalesTTM")), "fmt": "ratio", "definition": "Market cap divided by revenue. Useful for valuing companies that aren't yet profitable."},
            {"name": "Price/Book", "value": f(v.get("PriceBookMRQ")), "fmt": "ratio", "definition": "Market cap divided by net assets. Under 1 could mean the stock trades below its liquidation value."},
            {"name": "EV/Revenue", "value": f(v.get("EnterpriseValueRevenue")), "fmt": "ratio", "definition": "Enterprise value divided by revenue. Accounts for debt, giving a cleaner picture than Price/Sales."},
            {"name": "EV/EBITDA", "value": f(v.get("EnterpriseValueEbitda")), "fmt": "ratio", "definition": "Enterprise value divided by operating cash earnings. The go-to metric for comparing acquisition value."},
        ],
        "profitability": [
            {"name": "Gross Margin", "value": f(inc.get("grossProfit")) / f(inc.get("totalRevenue")) * 100 if f(inc.get("totalRevenue")) else None, "fmt": "pct", "definition": "Revenue minus cost of goods sold, as a percentage. Shows pricing power and production efficiency."},
            {"name": "Operating Margin", "value": f(h.get("OperatingMarginTTM")) and f(h.get("OperatingMarginTTM")) * 100, "fmt": "pct", "definition": "Profit from core operations as a percentage of revenue, before interest and taxes."},
            {"name": "Net Margin", "value": f(h.get("ProfitMargin")) and f(h.get("ProfitMargin")) * 100, "fmt": "pct", "definition": "What percentage of revenue turns into actual bottom-line profit after all expenses."},
            {"name": "ROE", "value": f(h.get("ReturnOnEquityTTM")) and f(h.get("ReturnOnEquityTTM")) * 100, "fmt": "pct", "definition": "How much profit the company generates with shareholders' money. Higher means more efficient."},
            {"name": "ROA", "value": f(h.get("ReturnOnAssetsTTM")) and f(h.get("ReturnOnAssetsTTM")) * 100, "fmt": "pct", "definition": "How efficiently the company uses all its assets to generate profit."},
            {"name": "R&D / Revenue", "value": f(inc.get("researchDevelopment")) / f(inc.get("totalRevenue")) * 100 if f(inc.get("totalRevenue")) and f(inc.get("researchDevelopment")) else None, "fmt": "pct", "definition": "How much of revenue is reinvested in research. High for tech, low for utilities."},
        ],
        "balance_sheet": [
            {"name": "Cash & Short-Term Investments", "value": f(bs.get("cashAndShortTermInvestments")), "fmt": "dollar", "definition": "Money the company can access quickly. Its war chest for opportunities or emergencies."},
            {"name": "Total Debt", "value": f(bs.get("shortLongTermDebtTotal")), "fmt": "dollar", "definition": "All money the company owes to lenders, both short-term and long-term."},
            {"name": "Net Debt", "value": f(bs.get("netDebt")), "fmt": "dollar", "definition": "Total debt minus cash. Negative means the company has more cash than debt."},
            {"name": "Total Assets", "value": f(bs.get("totalAssets")), "fmt": "dollar", "definition": "Everything the company owns — cash, buildings, equipment, investments, and intangibles."},
            {"name": "Total Equity", "value": f(bs.get("totalStockholderEquity")), "fmt": "dollar", "definition": "Assets minus liabilities. What shareholders actually own if the company liquidated today."},
            {"name": "Current Ratio", "value": f(bs.get("totalCurrentAssets")) / f(bs.get("totalCurrentLiabilities")) if f(bs.get("totalCurrentLiabilities")) else None, "fmt": "ratio", "definition": "Current assets divided by current liabilities. Above 1 means the company can pay its short-term bills."},
            {"name": "Debt/Equity", "value": f(bs.get("shortLongTermDebtTotal")) / f(bs.get("totalStockholderEquity")) if f(bs.get("totalStockholderEquity")) else None, "fmt": "ratio", "definition": "How much debt is used per dollar of equity. Lower is safer, but some debt can boost returns."},
        ],
        "cash_flow": [
            {"name": "Operating Cash Flow", "value": f(cf.get("totalCashFromOperatingActivities")), "fmt": "dollar", "definition": "Cash generated from the actual business operations. The truest measure of earning power."},
            {"name": "Capital Expenditures", "value": f(cf.get("capitalExpenditures")), "fmt": "dollar", "definition": "Money spent on buildings, equipment, and long-term assets. Necessary investment to keep growing."},
            {"name": "Free Cash Flow", "value": f(cf.get("freeCashFlow")), "fmt": "dollar", "definition": "Operating cash flow minus CapEx. Money left over to pay dividends, buy back stock, or reduce debt."},
            {"name": "Dividends Paid", "value": f(cf.get("dividendsPaid")), "fmt": "dollar", "definition": "Total cash returned to shareholders as dividends over the period."},
            {"name": "Stock Buybacks", "value": abs(f(cf.get("salePurchaseOfStock")) or 0) if f(cf.get("salePurchaseOfStock")) and f(cf.get("salePurchaseOfStock")) < 0 else None, "fmt": "dollar", "definition": "Money spent repurchasing the company's own shares, reducing share count and boosting EPS."},
            {"name": "Stock-Based Compensation", "value": f(cf.get("stockBasedCompensation")), "fmt": "dollar", "definition": "Non-cash expense from paying employees with stock options. Dilutes existing shareholders."},
        ],
        "income_statement": [
            {"name": "Revenue", "value": f(inc.get("totalRevenue")), "fmt": "dollar", "definition": "Total money earned from selling products and services before any costs are subtracted."},
            {"name": "Gross Profit", "value": f(inc.get("grossProfit")), "fmt": "dollar", "definition": "Revenue minus the direct cost of making products. The first layer of profitability."},
            {"name": "Operating Income", "value": f(inc.get("operatingIncome")), "fmt": "dollar", "definition": "Profit from core business after operating expenses but before interest and taxes."},
            {"name": "EBITDA", "value": f(inc.get("ebitda")), "fmt": "dollar", "definition": "Earnings before interest, taxes, depreciation, and amortization. A proxy for operating cash generation."},
            {"name": "Net Income", "value": f(inc.get("netIncome")), "fmt": "dollar", "definition": "The bottom line — total profit after every expense, tax, and interest payment."},
            {"name": "R&D Spending", "value": f(inc.get("researchDevelopment")), "fmt": "dollar", "definition": "How much the company invests in creating new products and improving existing ones."},
        ],
    }


# ---------------------------------------------------------------------------
# Health scores
# ---------------------------------------------------------------------------
def _clamp(value: float, lo: float = 0, hi: float = 100) -> int:
    return int(max(lo, min(hi, value)))


def _safe_float(val) -> float:
    """Convert any value to float, returning 0 on failure."""
    if val is None:
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def _compute_health(data: dict) -> dict:
    """
    Deterministic health scores from EODHD fundamentals.

    Profitability Score (0-100):
      - Net profit margin:    0% → 0pts,  30%+ → 40pts  (weight 40)
      - Operating margin:     0% → 0pts,  40%+ → 30pts  (weight 30)
      - ROE:                  0% → 0pts,  30%+ → 30pts  (weight 30)

    Debt Safety Score (0-100):
      - Current ratio:        <1 → 0pts,  2+ → 40pts    (weight 40)
      - Debt-to-equity:       >3 → 0pts,  0 → 35pts     (weight 35)
      - Net debt negative:    bonus 25pts if net debt < 0 (weight 25)
        else net debt / equity: >2 → 0pts, 0 → 25pts

    Growth Score (0-100):
      - Quarterly rev growth YOY:       <0 → 0pts, 30%+ → 50pts (weight 50)
      - Quarterly earnings growth YOY:  <0 → 0pts, 30%+ → 50pts (weight 50)
    """
    h = data.get("Highlights", {})
    bs_yearly = data.get("Financials", {}).get("Balance_Sheet", {}).get("yearly", {})
    latest_bs = next(iter(bs_yearly.values()), {}) if bs_yearly else {}

    # --- Profitability ---
    net_margin = _safe_float(h.get("ProfitMargin"))        # e.g. 0.27 = 27%
    op_margin = _safe_float(h.get("OperatingMarginTTM"))    # e.g. 0.35 = 35%
    roe = _safe_float(h.get("ReturnOnEquityTTM"))           # e.g. 1.52 = 152%

    prof_margin_pts = _clamp(net_margin / 0.30 * 40, 0, 40)
    prof_opmarg_pts = _clamp(op_margin / 0.40 * 30, 0, 30)
    prof_roe_pts = _clamp(min(roe, 0.50) / 0.30 * 30, 0, 30)  # cap ROE contribution at 50%
    profitability_score = _clamp(prof_margin_pts + prof_opmarg_pts + prof_roe_pts)

    # --- Debt Safety ---
    total_current_assets = _safe_float(latest_bs.get("totalCurrentAssets"))
    total_current_liab = _safe_float(latest_bs.get("totalCurrentLiabilities"))
    total_debt = _safe_float(latest_bs.get("shortLongTermDebtTotal"))
    total_equity = _safe_float(latest_bs.get("totalStockholderEquity"))
    net_debt = _safe_float(latest_bs.get("netDebt"))

    current_ratio = total_current_assets / total_current_liab if total_current_liab > 0 else 0
    debt_to_equity = total_debt / total_equity if total_equity > 0 else 99

    cr_pts = _clamp((current_ratio - 0.5) / 1.5 * 40, 0, 40)   # 0.5→0, 2.0→40
    de_pts = _clamp((1 - debt_to_equity / 3) * 35, 0, 35)       # 0→35, 3→0
    if net_debt < 0:
        nd_pts = 25  # net cash position = full marks
    else:
        nd_ratio = net_debt / total_equity if total_equity > 0 else 99
        nd_pts = _clamp((1 - nd_ratio / 2) * 25, 0, 25)
    debt_safety_score = _clamp(cr_pts + de_pts + nd_pts)

    # --- Growth ---
    rev_growth = _safe_float(h.get("QuarterlyRevenueGrowthYOY"))    # e.g. 0.157 = 15.7%
    earn_growth = _safe_float(h.get("QuarterlyEarningsGrowthYOY"))  # e.g. 0.183 = 18.3%

    rev_pts = _clamp(rev_growth / 0.30 * 50, 0, 50)
    earn_pts = _clamp(earn_growth / 0.30 * 50, 0, 50)
    growth_score = _clamp(rev_pts + earn_pts)

    return {
        "profitability_score": profitability_score,
        "debt_safety_score": debt_safety_score,
        "growth_score": growth_score,
        "details": {
            "net_margin": round(net_margin * 100, 1),
            "operating_margin": round(op_margin * 100, 1),
            "roe": round(roe * 100, 1),
            "current_ratio": round(current_ratio, 2),
            "debt_to_equity": round(debt_to_equity, 2),
            "revenue_growth_yoy": round(rev_growth * 100, 1),
            "earnings_growth_yoy": round(earn_growth * 100, 1),
        },
    }


@app.get("/api/health/{ticker}")
async def get_health(ticker: str):
    data = await _fetch_raw_fundamentals(ticker)
    result = _compute_health(data)
    return result



# ---------------------------------------------------------------------------
# SEC filings intelligence
# ---------------------------------------------------------------------------
SEC_HEADERS = {"User-Agent": "Lucid contact@lucid.app", "Accept-Encoding": "gzip, deflate"}


@app.get("/api/sec/{ticker}")
async def get_sec_intelligence(ticker: str):
    cache_key = f"sec:{ticker.upper()}"
    if cache_key in _gemini_cache:
        return JSONResponse(content=_gemini_cache[cache_key], media_type="application/json; charset=utf-8")
    try:
        return await _fetch_sec_data(ticker, cache_key)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="SEC data request failed. Try again.")


async def _fetch_sec_data(ticker: str, cache_key: str):
    async with httpx.AsyncClient(timeout=30) as client:
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
        f"From this MD&A excerpt for {ticker}, extract the following structured data.\n\n"
        "1. business_segments: array of objects for each business/product segment:\n"
        "   {{ name, revenue (string with $ and unit e.g. '$52.1B'), "
        "operating_income (string), margin_percent (number), yoy_revenue_change (string e.g. '+12.3%') }}\n\n"
        "2. geographic_segments: array of objects for each geographic region:\n"
        "   {{ region, revenue (string with $ and unit), percent_of_total (number), "
        "yoy_change (string e.g. '+8.1%') }}\n\n"
        "3. management_tone: one of positive/neutral/cautious\n"
        "4. key_risks: array of 3 specific risk strings from the filing\n"
        "5. key_opportunities: array of 3 specific opportunity strings from the filing\n\n"
        "If exact numbers aren't in the text, use your knowledge of the company's "
        "latest reported figures. Return ONLY valid JSON, no markdown or backticks.\n\n"
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

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
    except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.TimeoutException):
        raise HTTPException(status_code=500, detail="News request timed out. Try again.")

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
