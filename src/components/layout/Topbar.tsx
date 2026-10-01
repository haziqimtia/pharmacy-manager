import React from 'react';
import { useAuth } from '../../lib/auth';

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium text-slate-700">{user?.full_name}</div>
          <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
        </div>
        <button onClick={logout} className="btn-secondary">
          Log out
        </button>
      </div>
    </header>
  );
}
