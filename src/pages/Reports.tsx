import React, { useEffect, useState } from 'react';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import type { BestSellingRow, MonthlyReportRow, SlowMovingRow } from '../../electron/shared/types';

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type ReportTab = 'monthly' | 'bestSelling' | 'slowMoving';

export default function Reports() {
  const { formatCurrency } = useSettings();
  const toast = useToast();
  const [tab, setTab] = useState<ReportTab>('monthly');
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(today());

  const [monthly, setMonthly] = useState<MonthlyReportRow[]>([]);
  const [bestSelling, setBestSelling] = useState<BestSellingRow[]>([]);
  const [slowMoving, setSlowMoving] = useState<SlowMovingRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const filter = { start_date: startDate, end_date: endDate };
    const [m, b, s] = await Promise.all([
      window.api.reports.monthly(filter),
      window.api.reports.bestSelling(filter),
      window.api.reports.slowMoving(filter),
    ]);
    setMonthly(m);
    setBestSelling(b);
    setSlowMoving(s);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function exportCsv() {
    const result = await window.api.reports.exportCsv(tab, { start_date: startDate, end_date: endDate });
    if (result.success) toast.show(`Exported to ${result.path}`, 'success');
    else if (result.message !== 'Export cancelled') toast.show(result.message ?? 'Export failed', 'error');
  }

  async function exportPdf() {
    const result = await window.api.reports.exportPdf(tab, { start_date: startDate, end_date: endDate });
    if (result.success) toast.show(`Exported to ${result.path}`, 'success');
    else if (result.message !== 'Export cancelled') toast.show(result.message ?? 'Export failed', 'error');
  }

  const totals = monthly.reduce(
    (acc, r) => ({
      purchased_qty: acc.purchased_qty + r.purchased_qty,
      purchased_cost: acc.purchased_cost + r.purchased_cost,
      sold_qty: acc.sold_qty + r.sold_qty,
      sold_revenue: acc.sold_revenue + r.sold_revenue,
      profit: acc.profit + r.profit,
    }),
    { purchased_qty: 0, purchased_cost: 0, sold_qty: 0, sold_revenue: 0, profit: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end justify-between gap-4 p-4">
        <div className="flex items-end gap-4">
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn-secondary" onClick={exportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {([
          ['monthly', 'Monthly Summary'],
          ['bestSelling', 'Best Selling'],
          ['slowMoving', 'Slow-Moving / Dead Stock'],
        ] as [ReportTab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : tab === 'monthly' ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Month</th>
                <th>Purchased Qty</th>
                <th>Purchased Cost</th>
                <th>Sold Qty</th>
                <th>Revenue</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {monthly.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No activity in this period.
                  </td>
                </tr>
              ) : (
                monthly.map((r) => (
                  <tr key={r.period_label}>
                    <td>{r.period_label}</td>
                    <td>{r.purchased_qty}</td>
                    <td>{formatCurrency(r.purchased_cost)}</td>
                    <td>{r.sold_qty}</td>
                    <td>{formatCurrency(r.sold_revenue)}</td>
                    <td className="font-medium text-brand-700">{formatCurrency(r.profit)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {monthly.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td>Total</td>
                  <td>{totals.purchased_qty}</td>
                  <td>{formatCurrency(totals.purchased_cost)}</td>
                  <td>{totals.sold_qty}</td>
                  <td>{formatCurrency(totals.sold_revenue)}</td>
                  <td>{formatCurrency(totals.profit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : tab === 'bestSelling' ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {bestSelling.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No sales in this period.
                  </td>
                </tr>
              ) : (
                bestSelling.map((r) => (
                  <tr key={r.medicine_id}>
                    <td>{r.medicine_name}</td>
                    <td>{r.qty_sold}</td>
                    <td>{formatCurrency(r.revenue)}</td>
                    <td className="font-medium text-brand-700">{formatCurrency(r.profit)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Current Stock</th>
                <th>Last Sold</th>
                <th>Days Since Last Sale</th>
              </tr>
            </thead>
            <tbody>
              {slowMoving.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No slow-moving stock found.
                  </td>
                </tr>
              ) : (
                slowMoving.map((r) => (
                  <tr key={r.medicine_id}>
                    <td>{r.medicine_name}</td>
                    <td>{r.total_stock}</td>
                    <td>{r.last_sold_date ?? 'Never'}</td>
                    <td className={r.days_since_last_sale && r.days_since_last_sale > 60 ? 'font-semibold text-amber-600' : ''}>
                      {r.days_since_last_sale ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
