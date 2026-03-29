import { useState, useEffect } from "react";
import FINANCE_TERMS from "../data/financeTerms";

const ALL_TERMS = Object.entries(FINANCE_TERMS).sort(([a], [b]) => a.localeCompare(b));

export default function GlossaryDrawer() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(false);

  function handleOpen() {
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  }

  function handleClose() {
    setVisible(false);
    setTimeout(() => { setOpen(false); setSearch(""); }, 200);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = search
    ? ALL_TERMS.filter(([term, def]) =>
        term.toLowerCase().includes(search.toLowerCase()) ||
        def.toLowerCase().includes(search.toLowerCase())
      )
    : ALL_TERMS;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        title="Finance Glossary"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8M8 11h6" />
        </svg>
      </button>

      {/* Drawer overlay */}
      {open && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" onClick={handleClose} />

          {/* Drawer panel */}
          <div
            className={`absolute right-0 top-0 h-full w-full max-w-md border-l border-border bg-card shadow-2xl transition-transform duration-200 ${visible ? "translate-x-0" : "translate-x-full"}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="heading text-lg font-bold text-text-primary">Finance Glossary</h2>
                <p className="text-xs text-text-muted">{ALL_TERMS.length} terms in plain English</p>
              </div>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-border px-6 py-3">
              <div className="relative">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search terms..."
                  className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
                  autoFocus
                />
              </div>
            </div>

            {/* Term list */}
            <div className="overflow-y-auto" style={{ height: "calc(100% - 130px)" }}>
              {filtered.length > 0 ? (
                <div className="divide-y divide-border">
                  {filtered.map(([term, def]) => (
                    <div key={term} className="px-6 py-3 transition-colors hover:bg-surface">
                      <p className="text-sm font-semibold text-text-primary">{term}</p>
                      <p className="heading mt-0.5 text-xs italic leading-relaxed text-text-secondary">{def}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-text-muted">No terms match "{search}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
