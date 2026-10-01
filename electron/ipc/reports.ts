import { ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { ReportFilter, MonthlyReportRow, BestSellingRow, SlowMovingRow } from '../shared/types';
import { escapeHtml, exportHtmlToPdf } from '../printing';

function monthlyPurchases(db: ReturnType<typeof getDatabase>, filter: ReportFilter) {
  return db
    .prepare(
      `SELECT strftime('%Y-%m', p.purchase_date) as period, SUM(pi.quantity) as qty, SUM(pi.line_total) as cost
       FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id
       WHERE date(p.purchase_date) BETWEEN date(?) AND date(?)
       GROUP BY period`
    )
    .all(filter.start_date, filter.end_date) as { period: string; qty: number; cost: number }[];
}

function monthlySales(db: ReturnType<typeof getDatabase>, filter: ReportFilter) {
  return db
    .prepare(
      `SELECT strftime('%Y-%m', s.sale_date) as period,
              SUM(si.quantity) as qty,
              SUM(si.line_total) as revenue,
              SUM(si.line_total - si.quantity * si.unit_cost_price) as profit
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE date(s.sale_date) BETWEEN date(?) AND date(?)
       GROUP BY period`
    )
    .all(filter.start_date, filter.end_date) as { period: string; qty: number; revenue: number; profit: number }[];
}

function buildMonthlyReport(db: ReturnType<typeof getDatabase>, filter: ReportFilter): MonthlyReportRow[] {
  const purchases = monthlyPurchases(db, filter);
  const sales = monthlySales(db, filter);
  const periods = new Set<string>([...purchases.map((p) => p.period), ...sales.map((s) => s.period)]);
  const rows: MonthlyReportRow[] = [...periods].sort().map((period) => {
    const p = purchases.find((x) => x.period === period);
    const s = sales.find((x) => x.period === period);
    return {
      period_label: period,
      purchased_qty: p?.qty ?? 0,
      purchased_cost: p?.cost ?? 0,
      sold_qty: s?.qty ?? 0,
      sold_revenue: s?.revenue ?? 0,
      profit: s?.profit ?? 0,
    };
  });
  return rows;
}

function buildBestSelling(db: ReturnType<typeof getDatabase>, filter: ReportFilter): BestSellingRow[] {
  return db
    .prepare(
      `SELECT si.medicine_id, m.name as medicine_name,
              SUM(si.quantity) as qty_sold,
              SUM(si.line_total) as revenue,
              SUM(si.line_total - si.quantity * si.unit_cost_price) as profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN medicines m ON m.id = si.medicine_id
       WHERE date(s.sale_date) BETWEEN date(?) AND date(?)
       GROUP BY si.medicine_id
       ORDER BY qty_sold DESC
       LIMIT 25`
    )
    .all(filter.start_date, filter.end_date) as BestSellingRow[];
}

function buildSlowMoving(db: ReturnType<typeof getDatabase>, filter: ReportFilter): SlowMovingRow[] {
  return db
    .prepare(
      `SELECT * FROM (
         SELECT m.id as medicine_id, m.name as medicine_name,
                COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.medicine_id = m.id), 0) as total_stock,
                (SELECT MAX(s.sale_date) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.medicine_id = m.id) as last_sold_date
         FROM medicines m
         WHERE m.is_active = 1
       ) t
       WHERE t.total_stock > 0
       ORDER BY t.last_sold_date IS NOT NULL, t.last_sold_date ASC`
    )
    .all()
    .map((row: any) => ({
      ...row,
      days_since_last_sale: row.last_sold_date
        ? Math.floor((Date.now() - new Date(row.last_sold_date).getTime()) / 86400000)
        : null,
    })) as SlowMovingRow[];
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (val: string | number) => {
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
}

function reportToCsv(reportType: string, db: ReturnType<typeof getDatabase>, filter: ReportFilter): string {
  if (reportType === 'monthly') {
    const rows = buildMonthlyReport(db, filter);
    return toCsv(
      ['Period', 'Purchased Qty', 'Purchased Cost', 'Sold Qty', 'Sold Revenue', 'Profit'],
      rows.map((r) => [r.period_label, r.purchased_qty, r.purchased_cost, r.sold_qty, r.sold_revenue, r.profit])
    );
  }
  if (reportType === 'bestSelling') {
    const rows = buildBestSelling(db, filter);
    return toCsv(
      ['Medicine', 'Qty Sold', 'Revenue', 'Profit'],
      rows.map((r) => [r.medicine_name, r.qty_sold, r.revenue, r.profit])
    );
  }
  if (reportType === 'slowMoving') {
    const rows = buildSlowMoving(db, filter);
    return toCsv(
      ['Medicine', 'Current Stock', 'Last Sold Date', 'Days Since Last Sale'],
      rows.map((r) => [r.medicine_name, r.total_stock, r.last_sold_date ?? 'Never', r.days_since_last_sale ?? ''])
    );
  }
  throw new Error(`Unknown report type: ${reportType}`);
}

function reportToHtml(reportType: string, db: ReturnType<typeof getDatabase>, filter: ReportFilter): string {
  let title = '';
  let headers: string[] = [];
  let rows: (string | number)[][] = [];

  if (reportType === 'monthly') {
    title = 'Monthly Report';
    headers = ['Period', 'Purchased Qty', 'Purchased Cost', 'Sold Qty', 'Sold Revenue', 'Profit'];
    rows = buildMonthlyReport(db, filter).map((r) => [
      r.period_label,
      r.purchased_qty,
      r.purchased_cost.toFixed(2),
      r.sold_qty,
      r.sold_revenue.toFixed(2),
      r.profit.toFixed(2),
    ]);
  } else if (reportType === 'bestSelling') {
    title = 'Best Selling Medicines';
    headers = ['Medicine', 'Qty Sold', 'Revenue', 'Profit'];
    rows = buildBestSelling(db, filter).map((r) => [r.medicine_name, r.qty_sold, r.revenue.toFixed(2), r.profit.toFixed(2)]);
  } else if (reportType === 'slowMoving') {
    title = 'Slow-Moving / Dead Stock';
    headers = ['Medicine', 'Current Stock', 'Last Sold Date', 'Days Since Last Sale'];
    rows = buildSlowMoving(db, filter).map((r) => [
      r.medicine_name,
      r.total_stock,
      r.last_sold_date ?? 'Never',
      r.days_since_last_sale ?? '-',
    ]);
  } else {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    h1 { font-size: 18px; }
    .muted { color: #666; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; text-align: left; }
    th { background: #f3f4f6; }
  </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <div class="muted">${escapeHtml(filter.start_date)} to ${escapeHtml(filter.end_date)}</div>
    <table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </body></html>`;
}

export function registerReportHandlers() {
  const db = getDatabase();

  ipcMain.handle(IPC.REPORTS_MONTHLY, (_event, filter: ReportFilter) => buildMonthlyReport(db, filter));
  ipcMain.handle(IPC.REPORTS_BEST_SELLING, (_event, filter: ReportFilter) => buildBestSelling(db, filter));
  ipcMain.handle(IPC.REPORTS_SLOW_MOVING, (_event, filter: ReportFilter) => buildSlowMoving(db, filter));

  ipcMain.handle(IPC.REPORTS_EXPORT_CSV, async (_event, reportType: string, filter: ReportFilter) => {
    try {
      const csv = reportToCsv(reportType, db, filter);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export CSV',
        defaultPath: `${reportType}-report.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (canceled || !filePath) return { success: false, message: 'Export cancelled' };
      fs.writeFileSync(filePath, csv, 'utf-8');
      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Export failed' };
    }
  });

  ipcMain.handle(IPC.REPORTS_EXPORT_PDF, async (_event, reportType: string, filter: ReportFilter) => {
    try {
      const html = reportToHtml(reportType, db, filter);
      return await exportHtmlToPdf(html, `${reportType}-report.pdf`);
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Export failed' };
    }
  });
}
