import type { VerifyResponse } from '../lib/api';

const tone = {
  red: 'border-red-300 bg-red-600 text-white shadow-red-950/60',
  yellow: 'border-yellow-200 bg-yellow-400 text-slate-950 shadow-yellow-950/40',
  green: 'border-emerald-200 bg-emerald-500 text-slate-950 shadow-emerald-950/40',
};

export function StatusLight({ result }: { result: VerifyResponse | null }) {
  if (!result) {
    return (
      <div className="rounded-3xl border-2 border-slate-700 bg-slate-900 p-6 text-center text-slate-200 shadow-glow">
        <div className="mx-auto mb-4 h-20 w-20 rounded-full border-4 border-slate-600 bg-slate-800" />
        <p className="text-xl font-black">Waiting for YouTube handle</p>
        <p className="mt-2 text-sm text-slate-400">Search first, then register only green users.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border-4 p-6 text-center shadow-2xl ${tone[result.color]}`}>
      <div className="mx-auto mb-4 h-24 w-24 animate-pulse rounded-full border-4 border-current bg-white/30" />
      <p className="text-4xl font-black uppercase tracking-wide">{result.message}</p>
      <p className="mt-3 text-lg font-black">{result.youtube_handle}</p>
      {result.channel_title && <p className="mt-1 text-sm font-bold opacity-90">{result.channel_title}</p>}
      {result.sheet_row && <p className="mt-2 rounded-full bg-black/20 px-4 py-2 text-sm font-black">Sheet Row #{result.sheet_row}</p>}
    </div>
  );
}
