import asyncio
import json
import os

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

EODHD_API_KEY = os.getenv("EODHD_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

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
- table: array of {{ metric, stock1_value, stock2_value }} for P/E, Growth, Margin, Debt, Dividend
- verdict: 2-3 sentence plain English comparison
- pick_if_growth: ticker symbol
- pick_if_stability: ticker symbol

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


async def _fetch_stock_data(ticker: str) -> dict:
    """Fetch and clean stock data from EODHD for a single ticker."""
    url = f"https://eodhd.com/api/fundamentals/{ticker}.US"
    params = {"api_token": EODHD_API_KEY, "fmt": "json"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=15)

    if resp.status_code != 200 or not isinstance(resp.json(), dict):
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")

    data = resp.json()
    general = data.get("General", {})
    highlights = data.get("Highlights", {})

    if not general:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")

    description = general.get("Description", "") or ""

    return {
        "name": general.get("Name"),
        "ticker": general.get("Code"),
        "currency": general.get("CurrencyCode"),
        "price": highlights.get("WallStreetTargetPrice"),
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


@app.get("/api/stock/{ticker}")
async def get_stock(ticker: str):
    return await _fetch_stock_data(ticker)


@app.post("/api/analyze")
async def analyze_stock(req: AnalyzeRequest):
    prompt = ANALYZE_PROMPT + json.dumps(req.stock_data, indent=2)
    result = await _ask_gemini(prompt)
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


@app.post("/api/compare")
async def compare_stocks(req: CompareRequest):
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
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")


@app.post("/api/advice")
async def get_advice(req: AdviceRequest):
    prompt = ADVICE_PROMPT.format(
        stock_data=json.dumps(req.stock_data, indent=2),
        profile=json.dumps(req.profile.model_dump(), indent=2),
    )
    result = await _ask_gemini(prompt)
    return JSONResponse(content=result, media_type="application/json; charset=utf-8")
