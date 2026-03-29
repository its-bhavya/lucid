export default function ErrorCard({ message = "Couldn't load this.", onRetry }) {
  return (
    <div className="card-base border-red/15 bg-red/3 px-5 py-4 text-center">
      <p className="text-sm text-red">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-full border border-red/20 px-4 py-1.5 text-xs font-semibold text-red transition-all hover:-translate-y-px hover:bg-red/5"
        >
          Try again
        </button>
      )}
    </div>
  );
}
