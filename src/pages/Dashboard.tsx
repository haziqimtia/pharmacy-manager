import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../lib/settings';
import type { DashboardStats, LowStockItem, NearExpiryItem } from '../../electron/shared/types';

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'danger' | 'warn' }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className={`mt-2 text-2xl font-semibold ${
          tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-800'
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { formatCurrency } = useSettings();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [nearExpiry, setNearExpiry] = useState<NearExpiryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [s, low, expiry] = await Promise.all([
        window.api.dashboard.stats(),
        window.api.stock.lowStock(),
        window.api.stock.nearExpiry(),
      ]);
      if (!mounted) return;
      setStats(s);
      setLowStock(low.slice(0, 6));
      setNearExpiry(expiry.slice(0, 6));
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !stats) {
    return <div className="text-sm text-slate-400">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={formatCurrency(stats.today_sales_total)} hint={`${stats.today_invoice_count} invoices`} />
        <StatCard label="Today's Profit" value={formatCurrency(stats.today_profit)} />
        <StatCard
          label="Low Stock Items"
          value={String(stats.low_stock_count)}
          tone={stats.low_stock_count > 0 ? 'warn' : undefined}
        />
        <StatCard
          label="Near-Expiry Batches"
          value={String(stats.near_expiry_count)}
          tone={stats.near_expiry_count > 0 ? 'danger' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Medicines In Stock" value={String(stats.total_medicines_in_stock)} />
        <StatCard label="Inventory Value (Cost)" value={formatCurrency(stats.inventory_value_cost)} />
        <StatCard label="Inventory Value (Sale)" value={formatCurrency(stats.inventory_value_sale)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Low Stock</h2>
            <Link to="/stock" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing is running low.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.map((item) => (
                <li key={item.medicine_id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{item.medicine_name}</span>
                  <span className="font-medium text-amber-600">
                    {item.total_stock} / {item.reorder_level} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Near Expiry</h2>
            <Link to="/stock" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {nearExpiry.length === 0 ? (
            <p className="text-sm text-slate-400">No batches expiring soon.</p>
          ) : (
            <ul className="space-y-2">
              {nearExpiry.map((item) => (
                <li key={item.batch_id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {item.medicine_name} <span className="text-slate-400">({item.batch_number})</span>
                  </span>
                  <span className={`font-medium ${item.days_to_expiry <= 30 ? 'text-red-600' : 'text-amber-600'}`}>
                    {item.expiry_date} · {item.days_to_expiry}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
