import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';

export default function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) setError(result.message ?? 'Login failed');
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            {settings.pharmacy_name?.trim()?.[0]?.toUpperCase() || 'P'}
          </div>
          <h1 className="text-lg font-semibold text-slate-800">{settings.pharmacy_name || 'Pharmacy Manager'}</h1>
          <p className="text-sm text-slate-400">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Default: admin / admin123</p>
      </div>
    </div>
  );
}
