import { useState } from "react";
import FINANCE_TERMS from "../data/financeTerms";

export default function FinanceTerm({ term, definition }) {
  const [show, setShow] = useState(false);

  // Auto-lookup: dictionary first, then prop fallback
  const def =
    FINANCE_TERMS[term] ||
    Object.entries(FINANCE_TERMS).find(
      ([k]) => k.toLowerCase() === String(term).toLowerCase()
    )?.[1] ||
    definition ||
    null;

  return (
    <span
      className="relative inline"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={`cursor-help border-b border-dotted border-accent-light ${def ? "text-text-primary" : ""}`}>
        {term}
      </span>
      {show && def && (
        <span className="absolute bottom-full left-1/2 z-30 mb-2 w-[220px] -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card-hover)]">
          <span className="mb-1 block text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Plain English
          </span>
          <span className="heading block text-xs italic leading-relaxed text-text-secondary">
            {def}
          </span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-card" />
        </span>
      )}
    </span>
  );
}
