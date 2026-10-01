import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../../lib/settings';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/medicines', label: 'Medicines', icon: '💊' },
  { to: '/purchases', label: 'Purchases', icon: '📥' },
  { to: '/sales', label: 'Sales / POS', icon: '🧾' },
  { to: '/stock', label: 'Stock Ledger', icon: '📦' },
  { to: '/reports', label: 'Reports', icon: '📈' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  const { settings } = useSettings();
  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
          {settings.pharmacy_name?.trim()?.[0]?.toUpperCase() || 'P'}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{settings.pharmacy_name || 'Pharmacy Manager'}</div>
          <div className="text-xs text-slate-400">Offline POS</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
