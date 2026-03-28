import { useState } from "react";

export default function FinanceTerm({ term, definition }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="cursor-help border-b border-dotted border-accent-light text-text-primary">
        {term}
      </span>
      {show && definition && (
        <span className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-3 text-xs italic leading-relaxed text-text-secondary shadow-[var(--shadow-card-hover)]">
          {definition}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-card" />
        </span>
      )}
    </span>
  );
}
