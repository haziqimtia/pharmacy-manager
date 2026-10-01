import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { DashboardStats } from '../shared/types';

function getSettingNumber(db: ReturnType<typeof getDatabase>, key: string, fallback: number): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  const parsed = row ? Number(row.value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerDashboardHandlers() {
  const db = getDatabase();

  ipcMain.handle(IPC.DASHBOARD_STATS, (): DashboardStats => {
    const today = db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) as sales_total, COALESCE(SUM(profit_amount), 0) as profit, COUNT(*) as cnt
         FROM sales WHERE date(sale_date) = date('now')`
      )
      .get() as { sales_total: number; profit: number; cnt: number };

    const lowStock = db
      .prepare(
        `SELECT COUNT(*) as c FROM (
           SELECT m.id,
                  COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.medicine_id = m.id), 0) as total_stock,
                  m.reorder_level
           FROM medicines m WHERE m.is_active = 1
         ) t WHERE t.total_stock <= t.reorder_level`
      )
      .get() as { c: number };

    const nearExpiryDays = getSettingNumber(db, 'near_expiry_days', 90);
    const nearExpiry = db
      .prepare(
        `SELECT COUNT(*) as c FROM batches
         WHERE quantity > 0 AND julianday(expiry_date) - julianday('now') <= ?`
      )
      .get(nearExpiryDays) as { c: number };

    const inventory = db
      .prepare(
        `SELECT
           COUNT(DISTINCT CASE WHEN b.quantity > 0 THEN m.id END) as medicines_in_stock,
           COALESCE(SUM(b.quantity * b.purchase_price), 0) as value_cost,
           COALESCE(SUM(b.quantity * b.sale_price), 0) as value_sale
         FROM medicines m
         LEFT JOIN batches b ON b.medicine_id = m.id
         WHERE m.is_active = 1`
      )
      .get() as { medicines_in_stock: number; value_cost: number; value_sale: number };

    return {
      today_sales_total: today.sales_total,
      today_profit: today.profit,
      today_invoice_count: today.cnt,
      low_stock_count: lowStock.c,
      near_expiry_count: nearExpiry.c,
      total_medicines_in_stock: inventory.medicines_in_stock,
      inventory_value_cost: inventory.value_cost,
      inventory_value_sale: inventory.value_sale,
    };
  });
}
