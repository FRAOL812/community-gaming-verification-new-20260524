import { type FormEvent, useMemo, useState } from 'react';
import { Search, Save, Video } from 'lucide-react';
import { api, type VerifyResponse } from '../lib/api';
import { StatusLight } from '../components/StatusLight';

type Props = {
  token: string;
};

export function RegistrarPage({ token }: Props) {
  const [handle, setHandle] = useState('');
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '' });

  const canRegister = useMemo(() => result?.status === 'ready', [result]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setResult(null);
    setLoading(true);
    try {
      const response = await api.verifyHandle(handle, token);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!result) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await api.registerPlayer({
        full_name: form.full_name,
        email: form.email,
        phone_number: form.phone_number,
        youtube_handle: result.youtube_handle,
        channel_id: result.channel_id,
        channel_title: result.channel_title,
      }, token);
      setSuccess(response.message);
      setForm({ full_name: '', email: '', phone_number: '' });
      setHandle('');
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[1fr_0.95fr]">
      <section className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-glow">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-600 text-white"><Video /></div>
          <div>
            <h2 className="text-2xl font-black text-white">YouTube Verification</h2>
            <p className="text-sm font-medium text-slate-300">Enter the user handle before registration.</p>
          </div>
        </div>

        <form onSubmit={verify} className="flex flex-col gap-3 sm:flex-row">
          <input value={handle} onChange={(e) => setHandle(e.target.value)} className="min-h-16 flex-1 rounded-3xl border-2 border-white/10 bg-slate-950 px-5 text-xl font-black text-white outline-none placeholder:text-slate-500 focus:border-yellow-300" placeholder="@youtubehandle" />
          <button disabled={loading || handle.trim().length < 2} className="touch-button flex min-h-16 items-center justify-center gap-2 rounded-3xl bg-yellow-400 px-6 text-lg font-black text-slate-950 disabled:opacity-50 active:scale-95">
            <Search /> {loading ? 'Checking' : 'Verify'}
          </button>
        </form>

        <div className="mt-5">
          <StatusLight result={result} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-glow">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Registration</p>
          <h2 className="text-2xl font-black text-white">Player Details</h2>
          <p className="text-sm font-medium text-slate-300">The form unlocks only after GREEN Ready status.</p>
        </div>

        {error && <div className="mb-4 rounded-2xl bg-red-600 p-3 text-center text-sm font-black text-white">{error}</div>}
        {success && <div className="mb-4 rounded-2xl bg-emerald-400 p-3 text-center text-sm font-black text-slate-950">{success}</div>}

        <form onSubmit={register} className="space-y-4">
          <Field label="Full Name" value={form.full_name} disabled={!canRegister} onChange={(value) => setForm({ ...form, full_name: value })} placeholder="Participant full name" />
          <Field label="Email" value={form.email} disabled={!canRegister} onChange={(value) => setForm({ ...form, email: value })} placeholder="name@example.com" type="email" />
          <Field label="Phone Number" value={form.phone_number} disabled={!canRegister} onChange={(value) => setForm({ ...form, phone_number: value })} placeholder="09xxxxxxxx" />

          {result?.youtube_handle && (
            <div className="rounded-3xl border border-white/10 bg-slate-950 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Locked YouTube Handle</p>
              <p className="mt-1 text-xl font-black text-yellow-300">{result.youtube_handle}</p>
            </div>
          )}

          <button disabled={!canRegister || saving || !form.full_name || !form.email || !form.phone_number} className="touch-button flex min-h-16 w-full items-center justify-center gap-2 rounded-3xl bg-emerald-400 px-5 text-lg font-black text-slate-950 disabled:opacity-40 active:scale-95">
            <Save /> {saving ? 'Saving...' : 'Save to Google Sheet'}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, disabled, placeholder, type = 'text' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black uppercase tracking-wider text-slate-200">{label}</span>
      <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="min-h-14 w-full rounded-3xl border-2 border-white/10 bg-slate-950 px-5 text-base font-bold text-white outline-none placeholder:text-slate-500 focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40" placeholder={placeholder} />
    </label>
  );
}
