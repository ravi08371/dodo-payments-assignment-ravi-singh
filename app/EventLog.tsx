export type LogEntry = {
  id: number;
  time: string;
  name: string;
  tone: "neutral" | "success" | "error";
  payload?: unknown;
};

const toneStyles = {
  neutral: "bg-zinc-400",
  success: "bg-emerald-500",
  error: "bg-red-500",
};

export default function EventLog({ entries, onClear }: { entries: LogEntry[]; onClear: () => void }) {
  return (
    <section aria-labelledby="events-title" className="flex flex-col rounded-2xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <div>
          <h2 id="events-title" className="text-sm font-semibold">SDK events</h2>
          <p className="text-xs text-zinc-500">What this page hears from the checkout</p>
        </div>
        {entries.length > 0 && (
          <button onClick={onClear} className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
            Clear
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-400">
          Nothing yet. Click <span className="text-zinc-600">Buy now</span> to open the checkout.
        </p>
      ) : (
        <ol aria-live="polite" className="max-h-[520px] divide-y divide-zinc-100 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="animate-fade-in px-5 py-3">
              <div className="flex items-center gap-2">
                <span className={`size-1.5 rounded-full ${toneStyles[entry.tone]}`} />
                <code className="text-[13px] font-medium">{entry.name}</code>
                <time className="ml-auto font-mono text-[11px] text-zinc-400">{entry.time}</time>
              </div>
              {entry.payload !== undefined && (
                <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-700">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
