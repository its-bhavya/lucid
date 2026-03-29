import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import FINANCE_TERMS from "../data/financeTerms";

export default function FinanceTerm({ term, definition }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const def =
    FINANCE_TERMS[term] ||
    Object.entries(FINANCE_TERMS).find(
      ([k]) => k.toLowerCase() === String(term).toLowerCase()
    )?.[1] ||
    definition ||
    null;

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const tooltipH = 80; // approximate
    const spaceAbove = rect.top;
    const showBelow = spaceAbove < tooltipH + 12;

    setPos({
      left: rect.left + rect.width / 2,
      top: showBelow ? rect.bottom + 6 : rect.top - 6,
      below: showBelow,
    });
  }, []);

  function handleEnter() {
    if (!def) return;
    updatePos();
    setShow(true);
  }

  function handleLeave() {
    setShow(false);
    setPos(null);
  }

  return (
    <span
      ref={ref}
      className="relative inline"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <span className={`cursor-help border-b border-dotted border-accent-light ${def ? "text-text-primary" : ""}`}>
        {term}
      </span>
      {show && def && pos && createPortal(
        <span
          className="pointer-events-none fixed z-[9999] w-[220px] rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card-hover)]"
          style={{
            left: pos.left,
            top: pos.below ? pos.top : undefined,
            bottom: pos.below ? undefined : `${window.innerHeight - pos.top}px`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="mb-1 block text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Plain English
          </span>
          <span className="heading block text-xs italic leading-relaxed text-text-secondary">
            {def}
          </span>
          {/* Arrow */}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              pos.below
                ? "bottom-full border-b-card"
                : "top-full border-t-card"
            }`}
          />
        </span>,
        document.body
      )}
    </span>
  );
}
