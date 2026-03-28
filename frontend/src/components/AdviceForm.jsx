import { useState, useEffect } from "react";
import { getAdvice } from "../api";
import LoadingSpinner from "./LoadingSpinner";

const RISK_LEVELS = ["Conservative", "Moderate", "Aggressive"];
const TIME_OPTIONS = ["1 year", "3 years", "5-10 years", "10+ years"];

const VERDICT_STYLES = {
  BUY: "bg-green/10 text-green border-green/20",
  HOLD: "bg-yellow/10 text-yellow border-yellow/20",
  SELL: "bg-red/10 text-red border-red/20",
};

function formatAmount(n) {
  if (n == null) return "$0";
  return `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function AdviceForm({ stock, onClose }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState("form");
  const [fade, setFade] = useState(true);

  const [amount, setAmount] = useState("");
  const [risk, setRisk] = useState("Moderate");
  const [horizon, setHorizon] = useState("3 years");
  const [holdings, setHoldings] = useState("");

  const [advice, setAdvice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    function onKey(e) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  function transitionTo(nextStep) {
    setFade(false);
    setTimeout(() => {
      setStep(nextStep);
      setFade(true);
    }, 150);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    transitionTo("loading");

    try {
      const profile = {
        investable_amount: parseFloat(amount) || 0,
        risk_level: risk.toLowerCase(),
        time_horizon: horizon,
        current_holdings: holdings || "none",
      };
      const result = await getAdvice(stock, profile);
      setAdvice(result);
      transitionTo("result");
    } catch (err) {
      const msg =
        err.response?.data?.detail || err.response?.data?.message || "Failed to get advice";
      setError(msg);
      transitionTo("form");
    }
  }

  const verdictStyle = VERDICT_STYLES[advice?.recommendation] || "bg-surface text-text-muted border-border";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        className={`relative mx-4 my-10 w-full max-w-[560px] card-base shadow-[var(--shadow-card-hover)] transition-all duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        {/* Modal header */}
        <div className="border-b border-border px-8 py-5 pr-12">
          <h2 className="heading text-lg font-bold text-text-primary">
            Personalized Advice
          </h2>
          <p className="text-sm text-text-muted">
            for <span className="mono font-medium text-accent">{stock.ticker}</span> — {stock.name}
          </p>
        </div>

        {/* Content with fade transition */}
        <div className={`transition-opacity duration-150 ${fade ? "opacity-100" : "opacity-0"}`}>
          {/* Step 1 — Form */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-5 p-8">
              {error && (
                <div className="rounded-xl border border-red/20 bg-red/5 px-4 py-3 text-sm text-red">
                  {error}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Money available to invest
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="5000"
                    className="mono w-full rounded-xl border border-border bg-card py-2.5 pl-7 pr-4 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
                  />
                </div>
              </div>

              {/* Risk tolerance */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Risk tolerance
                </label>
                <div className="flex gap-2">
                  {RISK_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setRisk(level)}
                      className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                        risk === level
                          ? "border-accent bg-accent text-white shadow-md"
                          : "border-border bg-card text-text-secondary hover:border-accent-light hover:text-accent"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time horizon */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Time horizon
                </label>
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
                >
                  {TIME_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Current holdings */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Stocks you already own
                </label>
                <input
                  type="text"
                  value={holdings}
                  onChange={(e) => setHoldings(e.target.value)}
                  placeholder="e.g. VTI, QQQ, none"
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:shadow-lg"
              >
                Generate My Advice
              </button>
            </form>
          )}

          {/* Loading */}
          {step === "loading" && (
            <div className="p-8">
              <LoadingSpinner message="Generating personalized advice..." />
            </div>
          )}

          {/* Step 2 — Result */}
          {step === "result" && advice && (
            <div className="space-y-5 p-8">
              {/* Verdict badge */}
              <div className="flex flex-col items-center gap-2 text-center">
                <span className={`inline-block rounded-full border px-6 py-2 text-xl font-bold ${verdictStyle}`}>
                  {advice.recommendation}
                </span>
                <p className="mono text-3xl font-bold text-text-primary">
                  {formatAmount(advice.amount)}
                </p>
                <p className="text-sm text-text-muted">suggested investment</p>
              </div>

              {/* Why this fits you */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
                  Why This Fits You
                </h3>
                <div className="card-base p-4">
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {advice.reasoning}
                  </p>
                </div>
              </div>

              {/* Risks */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
                  Risks for Your Situation
                </h3>
                <ul className="space-y-2">
                  {advice.risks?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl bg-surface px-4 py-3">
                      <span className="mt-0.5 text-red">&#x2022;</span>
                      <span className="text-sm text-text-secondary">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Next step */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
                  Next Step
                </h3>
                <div className="card-base border-accent/20 bg-accent-soft/20 p-4">
                  <p className="text-sm font-medium text-accent">
                    {advice.next_step}
                  </p>
                </div>
              </div>

              {/* Back button */}
              <button
                onClick={handleClose}
                className="w-full rounded-full border border-accent py-3 text-sm font-semibold text-accent transition-all hover:-translate-y-px hover:bg-accent hover:text-white hover:shadow-md"
              >
                Back to Watchlist
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
