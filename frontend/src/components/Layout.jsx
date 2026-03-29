import GlossaryDrawer from "./GlossaryDrawer";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card shadow-[var(--shadow-card)]">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <span className="heading text-xl font-extrabold text-accent sm:text-2xl">Lucid ✦</span>
          <span className="hidden text-sm text-text-muted sm:inline">Invest with clarity</span>
        </div>
      </nav>
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="fade-in">
          {children}
        </div>
      </main>
      <GlossaryDrawer />
    </div>
  );
}
