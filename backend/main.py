import json
import os

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
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


class AnalyzeRequest(BaseModel):
    stock_data: dict


@app.get("/")
async def root():
    return {"message": "Lucid backend running"}


def _latest_financial(data: dict, sheet: str, field: str):
    yearly = data.get("Financials", {}).get(sheet, {}).get("yearly", {})
    if not yearly:
        return None
    latest = next(iter(yearly.values()))
    return latest.get(field)


@app.get("/api/stock/{ticker}")
async def get_stock(ticker: str):
    url = f"https://eodhd.com/api/fundamentals/{ticker}.US"
    params = {"api_token": EODHD_API_KEY, "fmt": "json"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=15)

    if resp.status_code != 200 or not isinstance(resp.json(), dict):
        raise HTTPException(status_code=404, detail="Ticker not found")

    data = resp.json()
    general = data.get("General", {})
    highlights = data.get("Highlights", {})

    if not general:
        raise HTTPException(status_code=404, detail="Ticker not found")

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


@app.post("/api/analyze")
async def analyze_stock(req: AnalyzeRequest):
    prompt = ANALYZE_PROMPT + json.dumps(req.stock_data, indent=2)

    try:
        model = genai.GenerativeModel("gemini-flash-latest")
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Strip markdown fences if Gemini ignores the instruction
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0].strip()
        from fastapi.responses import JSONResponse
        return JSONResponse(content=json.loads(text), media_type="application/json; charset=utf-8")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gemini returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
