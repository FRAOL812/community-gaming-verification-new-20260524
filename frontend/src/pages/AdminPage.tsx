import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Save, Trophy } from 'lucide-react';
import { createWorker, type Worker } from 'tesseract.js';
import { api, type Player, type Role } from '../lib/api';

type Props = {
  token: string;
  role: Role;
};

type Draft = {
  exit_level: ExitLevel;
  status: 'Won' | 'Failed';
  telebirr_ref: string;
};

const verificationStatusOptions = ['WIN', 'FAILED', 'DISQUALIFIED'] as const;
type VerificationStatus = (typeof verificationStatusOptions)[number] | 'PENDING';

const levelTree = [
  { level: 'Level 1', cards: 2, payout: 100, guarantee: false },
  { level: 'Level 2', cards: 3, payout: 500, guarantee: false },
  { level: 'Level 3', cards: 4, payout: 1500, guarantee: true },
  { level: 'Level 4', cards: 5, payout: 5000, guarantee: false },
  { level: 'Level 5', cards: 6, payout: 10000, guarantee: false },
  { level: 'Level 6', cards: 7, payout: 25000, guarantee: true },
  { level: 'Level 7', cards: 8, payout: 50000, guarantee: false },
  { level: 'Level 8', cards: 9, payout: 100000, guarantee: false },
  { level: 'Level 9', cards: 10, payout: 1000000, guarantee: true },
] as const;

type ExitLevel = (typeof levelTree)[number]['level'];

function payoutForWon(level: ExitLevel): number {
  const entry = levelTree.find((item) => item.level === level);
  return entry?.payout ?? 0;
}

function payoutForFailed(_level: ExitLevel): number {
  return 0;
}

function normalizeResultStatus(value: string): Draft['status'] | '' {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'won') return 'Won';
  if (normalized === 'failed' || normalized === 'fell') return 'Failed';
  return '';
}

function normalizeResultStatusForDisplay(value: string): string {
  return normalizeResultStatus(value);
}

function normalizeVerificationStatus(value: string): VerificationStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'win' || normalized === 'won' || normalized === 'completed') return 'WIN';
  if (normalized === 'failed' || normalized === 'fail') return 'FAILED';
  if (normalized === 'disqualified') return 'DISQUALIFIED';
  return 'PENDING';
}

function normalizeWinningsForComparison(value: string | number): string {
  const trimmed = String(value).trim();
  if (!trimmed) return '0';
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) return String(numeric);
  return trimmed;
}

function hasMeaningfulWinnings(value: string): boolean {
  return normalizeWinningsForComparison(value) !== '0';
}

function cleanRef(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function looksLikeRef(value: string): boolean {
  return value.length >= 8 && value.length <= 24 && /[A-Z]/.test(value) && /\d/.test(value);
}

function extractTelebirrReference(text: string): string | null {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const linePatterns = [
    /transaction\s*(?:number|no\.?|id|ref(?:erence)?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9 -]{4,40})/i,
    /trx\s*(?:number|no\.?|id|ref(?:erence)?)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 -]{4,40})/i,
  ];

  for (const line of lines) {
    for (const pattern of linePatterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const candidate = cleanRef(match[1] || '');
      if (looksLikeRef(candidate)) return candidate;
    }
  }

  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index].toLowerCase();
    if (current.includes('transaction number') || current.includes('transaction id') || current.includes('transaction ref')) {
      const candidate = cleanRef(lines[index + 1] || '');
      if (looksLikeRef(candidate)) return candidate;
    }
  }

  const fallbackMatches = text.toUpperCase().match(/\b[A-Z0-9]{8,24}\b/g) || [];
  for (const raw of fallbackMatches) {
    const candidate = cleanRef(raw);
    if (looksLikeRef(candidate)) return candidate;
  }

  return null;
}

function isPendingStatus(statusValue: string): boolean {
  return normalizeVerificationStatus(statusValue) === 'PENDING';
}

function hasExistingResult(player: Player): boolean {
  const existingStatus = normalizeResultStatus(player.result_status);
  return [
    player.exit_level.trim().length > 0,
    existingStatus.length > 0,
    hasMeaningfulWinnings(player.winnings),
    existingStatus === 'Won' && player.telebirr_ref.trim().length > 0,
  ].some(Boolean);
}

function hasLockedStatus(player: Player): boolean {
  return normalizeVerificationStatus(player.verification_status) !== 'PENDING';
}

function statusEditRequiresSuperAdmin(player: Player, nextStatus: string): boolean {
  const currentNormalized = normalizeVerificationStatus(player.verification_status);
  if (currentNormalized === 'PENDING') {
    return false;
  }
  return currentNormalized !== normalizeVerificationStatus(nextStatus);
}

function resultEditRequiresSuperAdmin(player: Player, nextDraft: Draft, nextWinnings: number): boolean {
  const existingStatus = normalizeResultStatus(player.result_status);
  const nextStatus = nextDraft.status;
  if (!existingStatus) return false;
  const existingValues = [
    player.exit_level.trim(),
    existingStatus,
    normalizeWinningsForComparison(player.winnings),
    existingStatus === 'Failed' ? '' : player.telebirr_ref.trim(),
  ];
  const hasRecordedResult = hasExistingResult(player);
  if (!hasRecordedResult) return false;

  const nextValues = [
    nextDraft.exit_level.trim(),
    nextStatus,
    normalizeWinningsForComparison(nextWinnings),
    nextStatus === 'Failed' ? '' : nextDraft.telebirr_ref.trim(),
  ];
  return nextValues.some((value, index) => value !== existingValues[index]);
}

export function AdminPage({ token, role }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [savingStatusRow, setSavingStatusRow] = useState<number | null>(null);
  const [ocrRow, setOcrRow] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<number, string>>({});
  const latestLoadIdRef = useRef(0);

  const loadPlayers = useCallback(async ({ showLoader = false }: { showLoader?: boolean } = {}) => {
    const loadId = ++latestLoadIdRef.current;
    if (showLoader) {
      setError('');
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const response = await api.getPlayers(token);
      if (loadId !== latestLoadIdRef.current) return;
      const ordered = [...response].sort((a, b) => b.row_number - a.row_number);
      setPlayers(ordered);
    } catch (err) {
      if (loadId !== latestLoadIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load players');
    } finally {
      if (loadId === latestLoadIdRef.current) {
        if (showLoader) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    }
  }, [token]);

  useEffect(() => {
    loadPlayers({ showLoader: true });
    const timer = window.setInterval(() => {
      void loadPlayers();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadPlayers]);

  const filtered = useMemo(() => {
    const value = query.toLowerCase().trim();
    if (!value) return players;
    return players.filter((player) => [
      player.full_name,
      player.youtube_handle,
      player.phone_number,
      player.email,
      player.telebirr_ref,
    ].join(' ').toLowerCase().includes(value));
  }, [players, query]);

  function draftFor(player: Player): Draft {
    const existingStatus = normalizeResultStatus(player.result_status);
    return drafts[player.row_number] || {
      exit_level: (player.exit_level as ExitLevel) || 'Level 1',
      status: existingStatus || 'Failed',
      telebirr_ref: player.telebirr_ref || '',
    };
  }

  function updateDraft(row: number, patch: Partial<Draft>) {
    const current = draftFor(players.find((p) => p.row_number === row)!);
    setDrafts({ ...drafts, [row]: { ...current, ...patch } });
  }

  function statusFor(player: Player): VerificationStatus {
    const raw = statusDrafts[player.row_number] ?? player.verification_status ?? 'PENDING';
    return normalizeVerificationStatus(raw);
  }

  function updateStatusDraft(row: number, nextStatus: string) {
    setStatusDrafts({ ...statusDrafts, [row]: normalizeVerificationStatus(nextStatus) });
  }

  async function readTelebirrRefFromImage(player: Player, file: File) {
    setOcrRow(player.row_number);
    setError('');
    setNotice('');
    let worker: Worker | null = null;

    try {
      worker = await createWorker('eng');
      const result = await worker.recognize(file);
      const reference = extractTelebirrReference(result.data.text || '');
      if (!reference) {
        throw new Error('Could not detect a transaction reference from this image.');
      }
      updateDraft(player.row_number, { telebirr_ref: reference });
      setNotice(`${player.full_name}: Telebirr ref extracted (${reference})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read transaction image');
    } finally {
      if (worker) {
        await worker.terminate();
      }
      setOcrRow(null);
    }
  }

  async function saveStatus(player: Player) {
    const nextStatus = statusFor(player).trim();
    if (!nextStatus) {
      setError('Verification status is required');
      return;
    }
    if (role === 'admin' && statusEditRequiresSuperAdmin(player, nextStatus)) {
      setError('This status was already filled. Super admin login is required to change it.');
      return;
    }
    setSavingStatusRow(player.row_number);
    setError('');
    setNotice('');
    try {
      const response = await api.updatePlayerStatus(player.row_number, { verification_status: nextStatus }, token);
      setNotice(`${player.full_name}: status updated to ${response.verification_status}`);
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update verification status');
    } finally {
      setSavingStatusRow(null);
    }
  }

  async function saveResult(player: Player) {
    if (isPendingStatus(statusFor(player))) {
      setError('Status is PENDING. Set player status to WIN, FAILED, or DISQUALIFIED before logging result.');
      return;
    }
    const draft = draftFor(player);
    const projectedWinnings = draft.status === 'Won' ? payoutForWon(draft.exit_level) : payoutForFailed(draft.exit_level);
    if (role === 'admin' && resultEditRequiresSuperAdmin(player, draft, projectedWinnings)) {
      setError('This result was already filled. Super admin login is required to change it.');
      return;
    }
    const payload = {
      ...draft,
      telebirr_ref: draft.status === 'Failed' ? '' : draft.telebirr_ref,
    };
    setSavingRow(player.row_number);
    setError('');
    setNotice('');
    try {
      const response = await api.logResult(player.row_number, payload, token);
      setNotice(`${player.full_name}: result saved. Winnings: $${response.winnings}`);
      await loadPlayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save result');
    } finally {
      setSavingRow(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-glow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">Operations / Payout</p>
            <h2 className="text-2xl font-black text-white">Registered Players</h2>
            <p className="text-sm font-medium text-slate-300">Live Google Sheet list. Auto-refreshes every 15 seconds.</p>
            {role === 'admin' && (
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-rose-300">
                Locked edit rule: second edit requires Super Admin privilege.
              </p>
            )}
          </div>
          <button onClick={() => loadPlayers({ showLoader: true })} disabled={refreshing || loading} className="touch-button flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 font-black text-slate-950 disabled:opacity-60 active:scale-95">
            <RefreshCw size={18} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} className="mt-4 min-h-14 w-full rounded-3xl border-2 border-white/10 bg-slate-950 px-5 text-base font-bold text-white outline-none placeholder:text-slate-500 focus:border-yellow-300" placeholder="Search name, handle, phone, email, Telebirr ref..." />
      </section>

      {error && <div className="mb-4 rounded-2xl bg-red-600 p-3 text-center text-sm font-black text-white">{error}</div>}
      {notice && <div className="mb-4 rounded-2xl bg-emerald-400 p-3 text-center text-sm font-black text-slate-950">{notice}</div>}

      {loading ? (
        <div className="rounded-[2rem] border border-white/10 bg-slate-900 p-8 text-center text-lg font-black text-white">Loading players...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[2rem] border border-white/10 bg-slate-900 p-8 text-center text-lg font-black text-white">No players found.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((player) => {
            const draft = draftFor(player);
            const currentStatus = statusFor(player);
            const pendingStatus = isPendingStatus(currentStatus);
            const failedResult = draft.status === 'Failed';
            const preview = draft.status === 'Won' ? payoutForWon(draft.exit_level) : payoutForFailed(draft.exit_level);
            const statusLocked = hasLockedStatus(player);
            const resultFilled = hasExistingResult(player);
            const statusChangeLockedForAdmin = role === 'admin' && statusEditRequiresSuperAdmin(player, currentStatus);
            const resultChangeLockedForAdmin = role === 'admin' && resultEditRequiresSuperAdmin(player, draft, preview);
            const recordedResultStatus = normalizeResultStatusForDisplay(player.result_status);
            return (
              <article key={player.row_number} className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-glow">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-slate-950">Row {player.row_number}</span>
                      <span className="rounded-full bg-sky-900 px-3 py-1 text-xs font-black text-sky-200">Status: {normalizeVerificationStatus(player.verification_status)}</span>
                      {recordedResultStatus ? <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-slate-950">Logged: {recordedResultStatus}</span> : <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black text-white">Pending Result</span>}
                      {statusLocked && <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">Status Locked</span>}
                      {resultFilled && <span className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-black text-white">Result Filled</span>}
                      {role === 'super_admin' && (statusLocked || resultFilled) && (
                        <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">Super Admin Override Enabled</span>
                      )}
                    </div>
                    <h3 className="truncate text-2xl font-black text-white">{player.full_name}</h3>
                    <p className="text-lg font-black text-yellow-300">{player.youtube_handle}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-300">{player.phone_number} | {player.email}</p>
                    {player.telebirr_ref && <p className="mt-2 text-sm font-black text-emerald-300">Telebirr: {player.telebirr_ref}</p>}
                    {(statusLocked || resultFilled) && (
                      <div className="mt-3 rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-3 text-xs font-bold text-indigo-100">
                        <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-indigo-200">Already Saved Data</p>
                        <div className="grid gap-1 sm:grid-cols-2">
                          <p>Status: <span className="font-black text-white">{normalizeVerificationStatus(player.verification_status)}</span></p>
                          <p>Exit Level: <span className="font-black text-white">{player.exit_level || '-'}</span></p>
                          <p>Result: <span className="font-black text-white">{recordedResultStatus || '-'}</span></p>
                          <p>Winnings: <span className="font-black text-white">{player.winnings || '-'}</span></p>
                          <p>Telebirr Ref: <span className="font-black text-white">{player.telebirr_ref || '-'}</span></p>
                          <p>Updated At: <span className="font-black text-white">{player.updated_at || '-'}</span></p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:w-[520px]">
                    <div className="sm:col-span-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3">
                      <p className="mb-2 text-xs font-black uppercase tracking-wider text-sky-200">Update Registration Status</p>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <select value={currentStatus} onChange={(e) => updateStatusDraft(player.row_number, e.target.value)} className="min-h-12 w-full rounded-2xl border-2 border-white/10 bg-slate-950 px-3 font-black text-white outline-none focus:border-sky-300">
                          {currentStatus === 'PENDING' && <option value="PENDING" disabled>PENDING (initial)</option>}
                          {verificationStatusOptions.map((statusValue) => (
                            <option key={statusValue}>{statusValue}</option>
                          ))}
                        </select>
                        <button onClick={() => saveStatus(player)} disabled={savingStatusRow === player.row_number} className="touch-button min-h-12 rounded-2xl bg-sky-300 px-4 font-black text-slate-950 disabled:opacity-50 active:scale-95">
                          {savingStatusRow === player.row_number ? 'Updating...' : 'Update Status'}
                        </button>
                      </div>
                      {statusChangeLockedForAdmin && (
                        <p className="mt-2 text-xs font-black uppercase tracking-wide text-rose-200">
                          Admin cannot overwrite this status. Super admin must perform this change.
                        </p>
                      )}
                    </div>

                      {pendingStatus && (
                        <p className="sm:col-span-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-200">
                          PENDING status selected. Result section stays disabled until status is WIN, FAILED, or DISQUALIFIED.
                        </p>
                      )}

                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-300">Exit Level</span>
                      <select value={draft.exit_level} disabled={pendingStatus} onChange={(e) => updateDraft(player.row_number, { exit_level: e.target.value as Draft['exit_level'] })} className="min-h-12 w-full rounded-2xl border-2 border-white/10 bg-slate-950 px-3 font-black text-white outline-none focus:border-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
                        {levelTree.map((levelInfo) => (
                          <option key={levelInfo.level} value={levelInfo.level}>
                            {levelInfo.level} ({levelInfo.cards} cards) - {levelInfo.payout}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-300">Result</span>
                      <select value={draft.status} disabled={pendingStatus} onChange={(e) => updateDraft(player.row_number, { status: e.target.value as Draft['status'] })} className="min-h-12 w-full rounded-2xl border-2 border-white/10 bg-slate-950 px-3 font-black text-white outline-none focus:border-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
                        <option>Failed</option>
                        <option>Won</option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-300">Telebirr Ref</span>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input value={draft.telebirr_ref} disabled={pendingStatus || failedResult} onChange={(e) => updateDraft(player.row_number, { telebirr_ref: e.target.value })} className="min-h-12 w-full rounded-2xl border-2 border-white/10 bg-slate-950 px-4 font-bold text-white outline-none placeholder:text-slate-500 focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50" placeholder={failedResult ? 'Disabled for failed result' : 'Payment transaction ID'} />
                        <label className={`touch-button flex min-h-12 items-center justify-center rounded-2xl px-4 font-black ${(pendingStatus || failedResult) ? 'cursor-not-allowed bg-slate-700 text-slate-300 opacity-60' : ocrRow === player.row_number ? 'cursor-not-allowed bg-slate-700 text-slate-300' : 'cursor-pointer bg-emerald-300 text-slate-950'} ${ocrRow !== null && ocrRow !== player.row_number ? 'opacity-60' : ''}`}>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={pendingStatus || failedResult || ocrRow !== null}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              if (file) {
                                void readTelebirrRefFromImage(player, file);
                              }
                            }}
                          />
                          {(pendingStatus || failedResult) ? 'Disabled' : ocrRow === player.row_number ? 'Reading Photo...' : 'Pick Photo'}
                        </label>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {failedResult ? 'Transaction reference is blocked for failed players (no payout).' : 'Mobile: choose Telebirr receipt image from gallery to auto-fill the reference.'}
                      </p>
                    </label>
                    <div className="flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-white">
                      <Trophy className="text-yellow-300" />
                      <span className="text-sm font-black">Winnings: ${preview}</span>
                    </div>
                    <p className="self-center text-xs font-semibold text-slate-300">
                      Failed players are not paid and cannot submit transaction references.
                    </p>
                    <button onClick={() => saveResult(player)} disabled={pendingStatus || savingRow === player.row_number} className="touch-button flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 font-black text-slate-950 disabled:opacity-50 active:scale-95">
                      <Save size={18} /> {savingRow === player.row_number ? 'Saving...' : 'Log Result'}
                    </button>
                    {resultChangeLockedForAdmin && (
                      <p className="sm:col-span-2 text-xs font-black uppercase tracking-wide text-rose-200">
                        Admin cannot overwrite this result. Super admin must perform this change.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}


