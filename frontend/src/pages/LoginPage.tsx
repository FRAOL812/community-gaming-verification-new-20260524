import { type FormEvent, useState } from 'react';
import { Crown, Gamepad2, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { api, type Role } from '../lib/api';

type Props = {
  onLogin: (token: string, role: Role) => void;
};

export function LoginPage({ onLogin }: Props) {
  const [role, setRole] = useState<Role>('registrar');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.login(role, password);
      onLogin(response.token, response.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-yellow-400 text-slate-950 shadow-glow">
            <Gamepad2 size={42} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-yellow-300">Street Engagement Tool</p>
          <h1 className="mt-2 text-3xl font-black leading-tight">Community Registration & Verification</h1>
          <p className="mt-3 text-sm font-medium text-slate-300">High-contrast outdoor-ready access panel for Addis Ababa operations.</p>
        </div>

        <form onSubmit={submit} className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-glow backdrop-blur">
          <label className="mb-3 block text-sm font-black uppercase tracking-wider text-slate-200">Choose entry point</label>
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => setRole('registrar')} className={`touch-button rounded-3xl border-2 p-4 text-left active:scale-95 ${role === 'registrar' ? 'border-yellow-300 bg-yellow-400 text-slate-950' : 'border-white/10 bg-slate-900 text-white'}`}>
              <UserCheck className="mb-3" />
              <span className="block text-lg font-black">Registrar</span>
              <span className="text-xs font-bold opacity-80">Verify and register</span>
            </button>
            <button type="button" onClick={() => setRole('admin')} className={`touch-button rounded-3xl border-2 p-4 text-left active:scale-95 ${role === 'admin' ? 'border-yellow-300 bg-yellow-400 text-slate-950' : 'border-white/10 bg-slate-900 text-white'}`}>
              <ShieldCheck className="mb-3" />
              <span className="block text-lg font-black">Admin</span>
              <span className="text-xs font-bold opacity-80">Results and payout</span>
            </button>
            <button type="button" onClick={() => setRole('super_admin')} className={`touch-button rounded-3xl border-2 p-4 text-left active:scale-95 ${role === 'super_admin' ? 'border-yellow-300 bg-yellow-400 text-slate-950' : 'border-white/10 bg-slate-900 text-white'}`}>
              <Crown className="mb-3" />
              <span className="block text-lg font-black">Super Admin</span>
              <span className="text-xs font-bold opacity-80">Can edit locked rows</span>
            </button>
          </div>

          <label className="mt-5 block text-sm font-black uppercase tracking-wider text-slate-200">Password</label>
          <div className="mt-2 flex items-center gap-3 rounded-3xl border-2 border-white/10 bg-slate-950 px-4 py-2 focus-within:border-yellow-300">
            <Lock className="text-yellow-300" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="min-h-14 flex-1 bg-transparent text-lg font-black text-white outline-none placeholder:text-slate-500" placeholder="Enter role password" />
          </div>

          {error && <div className="mt-4 rounded-2xl bg-red-600 p-3 text-center text-sm font-black text-white">{error}</div>}

          <button disabled={loading} className="touch-button mt-5 w-full rounded-3xl bg-emerald-400 px-5 py-4 text-lg font-black text-slate-950 shadow-glow disabled:opacity-60 active:scale-95">
            {loading ? 'Checking...' : 'Enter System'}
          </button>
        </form>
      </section>
    </main>
  );
}
