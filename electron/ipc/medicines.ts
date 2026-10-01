import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { Medicine, MedicineInput, Batch } from '../shared/types';
import type { ListFilter } from '../shared/api-types';

function validateMedicineInput(input: MedicineInput) {
  if (!input.name || !input.name.trim()) throw new Error('Medicine name is required');
  if (!input.unit) throw new Error('Unit is required');
  if (input.reorder_level < 0) throw new Error('Reorder level cannot be negative');
  if (input.default_sale_price < 0) throw new Error('Sale price cannot be negative');
}

const MEDICINE_SELECT = `
  SELECT
    m.*,
    c.name AS category_name,
    COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.medicine_id = m.id), 0) AS total_stock,
    COALESCE((SELECT SUM(b.quantity * b.purchase_price) FROM batches b WHERE b.medicine_id = m.id), 0) AS stock_value_cost,
    COALESCE((SELECT SUM(b.quantity * b.sale_price) FROM batches b WHERE b.medicine_id = m.id), 0) AS stock_value_sale,
    (SELECT MIN(b.expiry_date) FROM batches b WHERE b.medicine_id = m.id AND b.quantity > 0) AS nearest_expiry
  FROM medicines m
  LEFT JOIN categories c ON c.id = m.category_id
`;

export function registerMedicineHandlers() {
  const db = getDatabase();

  ipcMain.handle(IPC.MEDICINES_LIST, (_event, filter?: ListFilter): Medicine[] => {
    let sql = MEDICINE_SELECT + ' WHERE 1=1';
    const params: unknown[] = [];
    if (filter?.search) {
      sql += ' AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.manufacturer LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }
    sql += ' ORDER BY m.name ASC';
    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
      if (filter?.offset) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }
    }
    return db.prepare(sql).all(...params) as Medicine[];
  });

  ipcMain.handle(IPC.MEDICINES_GET, (_event, id: number): Medicine | null => {
    const row = db.prepare(MEDICINE_SELECT + ' WHERE m.id = ?').get(id) as Medicine | undefined;
    return row ?? null;
  });

  ipcMain.handle(IPC.MEDICINES_CREATE, (_event, input: MedicineInput): Medicine => {
    validateMedicineInput(input);
    const info = db
      .prepare(
        `INSERT INTO medicines (name, generic_name, category_id, manufacturer, unit, reorder_level, default_sale_price, is_active)
         VALUES (@name, @generic_name, @category_id, @manufacturer, @unit, @reorder_level, @default_sale_price, @is_active)`
      )
      .run(input);
    const row = db.prepare(MEDICINE_SELECT + ' WHERE m.id = ?').get(Number(info.lastInsertRowid)) as Medicine;
    return row;
  });

  ipcMain.handle(IPC.MEDICINES_UPDATE, (_event, id: number, input: MedicineInput): Medicine => {
    validateMedicineInput(input);
    const existing = db.prepare('SELECT id FROM medicines WHERE id = ?').get(id);
    if (!existing) throw new Error('Medicine not found');
    db.prepare(
      `UPDATE medicines SET
        name = @name,
        generic_name = @generic_name,
        category_id = @category_id,
        manufacturer = @manufacturer,
        unit = @unit,
        reorder_level = @reorder_level,
        default_sale_price = @default_sale_price,
        is_active = @is_active,
        updated_at = datetime('now')
       WHERE id = @id`
    ).run({ ...input, id });
    const row = db.prepare(MEDICINE_SELECT + ' WHERE m.id = ?').get(id) as Medicine;
    return row;
  });

  ipcMain.handle(IPC.MEDICINES_DELETE, (_event, id: number) => {
    try {
      const info = db.prepare('DELETE FROM medicines WHERE id = ?').run(id);
      if (info.changes === 0) return { success: false, message: 'Medicine not found' };
      return { success: true };
    } catch (err) {
      // Referenced by purchase/sale history (FK RESTRICT) -> soft delete instead.
      db.prepare("UPDATE medicines SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
      return {
        success: true,
        message: 'Medicine has purchase/sale history, so it was deactivated instead of permanently deleted.',
      };
    }
  });

  ipcMain.handle(IPC.MEDICINES_BATCHES, (_event, medicineId: number): Batch[] => {
    return db
      .prepare(
        `SELECT b.*, m.name as medicine_name FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         WHERE b.medicine_id = ? ORDER BY date(b.expiry_date) ASC`
      )
      .all(medicineId) as Batch[];
  });
}
