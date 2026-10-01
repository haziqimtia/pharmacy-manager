import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { StockMovement, ManualStockAdjustmentInput, LowStockItem, NearExpiryItem } from '../shared/types';
import type { ListFilter } from '../shared/api-types';

function getSettingNumber(db: ReturnType<typeof getDatabase>, key: string, fallback: number): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  const parsed = row ? Number(row.value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerStockHandlers() {
  const db = getDatabase();

  ipcMain.handle(IPC.STOCK_MOVEMENTS_LIST, (_event, filter?: ListFilter & { medicine_id?: number }): StockMovement[] => {
    let sql = `
      SELECT sm.*, m.name as medicine_name, b.batch_number as batch_number
      FROM stock_movements sm
      JOIN medicines m ON m.id = sm.medicine_id
      LEFT JOIN batches b ON b.id = sm.batch_id
      WHERE 1=1`;
    const params: unknown[] = [];
    if (filter?.medicine_id) {
      sql += ' AND sm.medicine_id = ?';
      params.push(filter.medicine_id);
    }
    if (filter?.search) {
      sql += ' AND (m.name LIKE ? OR sm.reason LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term);
    }
    if (filter?.start_date) {
      sql += ' AND date(sm.movement_date) >= date(?)';
      params.push(filter.start_date);
    }
    if (filter?.end_date) {
      sql += ' AND date(sm.movement_date) <= date(?)';
      params.push(filter.end_date);
    }
    sql += ' ORDER BY sm.movement_date DESC, sm.id DESC';
    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
      if (filter?.offset) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }
    }
    return db.prepare(sql).all(...params) as StockMovement[];
  });

  const adjustTx = db.transaction((input: ManualStockAdjustmentInput) => {
    const batch = db.prepare('SELECT id, quantity, medicine_id FROM batches WHERE id = ?').get(input.batch_id) as
      | { id: number; quantity: number; medicine_id: number }
      | undefined;
    if (!batch) throw new Error('Batch not found');
    if (batch.medicine_id !== input.medicine_id) throw new Error('Batch does not belong to the selected medicine');
    if (!(input.quantity > 0)) throw new Error('Quantity must be greater than zero');
    if (!input.reason || !input.reason.trim()) throw new Error('Reason is required');

    const isInbound = input.movement_type === 'return_in';
    const delta = isInbound ? input.quantity : -input.quantity;

    if (!isInbound && batch.quantity < input.quantity) {
      throw new Error(`Cannot remove ${input.quantity} units; only ${batch.quantity} available in this batch`);
    }

    db.prepare(`UPDATE batches SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?`).run(
      delta,
      input.batch_id
    );
    db.prepare(
      `INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity_change, reference_type, reason)
       VALUES (?, ?, ?, ?, 'manual', ?)`
    ).run(input.medicine_id, input.batch_id, input.movement_type, delta, input.reason.trim());
  });

  ipcMain.handle(IPC.STOCK_ADJUST, (_event, input: ManualStockAdjustmentInput) => {
    try {
      adjustTx(input);
      return { success: true };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to adjust stock' };
    }
  });

  ipcMain.handle(IPC.STOCK_LOW, (): LowStockItem[] => {
    return db
      .prepare(
        `SELECT * FROM (
           SELECT m.id as medicine_id, m.name as medicine_name, m.unit, m.reorder_level,
                  COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.medicine_id = m.id), 0) as total_stock
           FROM medicines m
           WHERE m.is_active = 1
         ) t
         WHERE t.total_stock <= t.reorder_level
         ORDER BY t.total_stock ASC`
      )
      .all() as LowStockItem[];
  });

  ipcMain.handle(IPC.STOCK_NEAR_EXPIRY, (_event, days?: number): NearExpiryItem[] => {
    const threshold = days ?? getSettingNumber(db, 'near_expiry_days', 90);
    return db
      .prepare(
        `SELECT b.id as batch_id, b.medicine_id, m.name as medicine_name, b.batch_number, b.expiry_date, b.quantity,
                CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_to_expiry
         FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         WHERE b.quantity > 0 AND julianday(b.expiry_date) - julianday('now') <= ?
         ORDER BY date(b.expiry_date) ASC`
      )
      .all(threshold) as NearExpiryItem[];
  });
}
