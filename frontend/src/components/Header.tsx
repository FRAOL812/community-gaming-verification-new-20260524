import { LogOut, ShieldCheck } from 'lucide-react';
import type { Role } from '../lib/api';

type Props = {
  role: Role;
  onLogout: () => void;
};

export function Header({ role, onLogout }: Props) {
  const roleLabel =
    role === 'super_admin'
      ? 'Operations / Super Admin'
      : role === 'admin'
        ? 'Operations / Admin'
        : 'Registrar';

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-yellow-400 text-slate-950 shadow-glow">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">Addis Game Ops</p>
            <h1 className="text-lg font-black text-white sm:text-2xl">Community Verification</h1>
          </div>
        </div>
        <button onClick={onLogout} className="touch-button flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 active:scale-95">
          <LogOut size={18} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
      <div className="bg-yellow-400 py-1 text-center text-xs font-black uppercase tracking-widest text-slate-950">
        Active role: {roleLabel}
      </div>
    </header>
  );
}
