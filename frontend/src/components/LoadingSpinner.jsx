export default function LoadingSpinner({ message = "Analyzing..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute h-12 w-12 animate-ping rounded-full bg-accent-soft/60" />
        <div className="absolute h-8 w-8 animate-pulse rounded-full bg-accent-light/30" />
        <div className="h-4 w-4 rounded-full bg-accent" />
      </div>
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}
