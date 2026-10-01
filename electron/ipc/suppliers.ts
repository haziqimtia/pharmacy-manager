import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { Supplier, SupplierInput } from '../shared/types';

function validateSupplierInput(input: SupplierInput) {
  if (!input.name || !input.name.trim()) throw new Error('Supplier name is required');
}

export function registerSupplierHandlers() {
  const db = getDatabase();

  ipcMain.handle(IPC.SUPPLIERS_LIST, (): Supplier[] => {
    return db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all() as Supplier[];
  });

  ipcMain.handle(IPC.SUPPLIERS_CREATE, (_event, input: SupplierInput): Supplier => {
    validateSupplierInput(input);
    const info = db
      .prepare(
        `INSERT INTO suppliers (name, contact_person, phone, email, address, notes, is_active)
         VALUES (@name, @contact_person, @phone, @email, @address, @notes, @is_active)`
      )
      .run(input);
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(info.lastInsertRowid)) as Supplier;
  });

  ipcMain.handle(IPC.SUPPLIERS_UPDATE, (_event, id: number, input: SupplierInput): Supplier => {
    validateSupplierInput(input);
    const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
    if (!existing) throw new Error('Supplier not found');
    db.prepare(
      `UPDATE suppliers SET
        name = @name, contact_person = @contact_person, phone = @phone, email = @email,
        address = @address, notes = @notes, is_active = @is_active, updated_at = datetime('now')
       WHERE id = @id`
    ).run({ ...input, id });
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as Supplier;
  });

  ipcMain.handle(IPC.SUPPLIERS_DELETE, (_event, id: number) => {
    try {
      const info = db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
      if (info.changes === 0) return { success: false, message: 'Supplier not found' };
      return { success: true };
    } catch {
      db.prepare("UPDATE suppliers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
      return {
        success: true,
        message: 'Supplier has purchase history, so it was deactivated instead of permanently deleted.',
      };
    }
  });
}
