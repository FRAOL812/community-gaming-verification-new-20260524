import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { RegistrarPage } from './pages/RegistrarPage';
import { AdminPage } from './pages/AdminPage';
import type { Role } from './lib/api';

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('cg_token') || '');
  const [role, setRole] = useState<Role>(() => (localStorage.getItem('cg_role') as Role) || 'registrar');

  useEffect(() => {
    if (token) localStorage.setItem('cg_token', token);
    if (role) localStorage.setItem('cg_role', role);
  }, [token, role]);

  function handleLogin(nextToken: string, nextRole: Role) {
    setToken(nextToken);
    setRole(nextRole);
  }

  function logout() {
    localStorage.removeItem('cg_token');
    localStorage.removeItem('cg_role');
    setToken('');
    setRole('registrar');
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header role={role} onLogout={logout} />
      {role === 'admin' || role === 'super_admin' ? <AdminPage token={token} role={role} /> : <RegistrarPage token={token} />}
    </div>
  );
}

export default App;
