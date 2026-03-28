export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-4">
          <span className="text-xl font-bold text-white">Lucid</span>
          <span className="text-sm text-text-muted">Invest with clarity</span>
        </div>
      </nav>
      <main className="mx-auto max-w-[1100px] px-6 py-8">
        {children}
      </main>
    </div>
  );
}
