import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

load_dotenv()

EODHD_API_KEY = os.getenv("EODHD_API_KEY", "")

app = FastAPI()


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
