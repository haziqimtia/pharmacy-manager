import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { Purchase, PurchaseInput, PurchaseItem } from '../shared/types';
import type { ListFilter } from '../shared/api-types';

function validatePurchaseInput(input: PurchaseInput) {
  if (!input.items || input.items.length === 0) throw new Error('At least one item is required');
  for (const item of input.items) {
    if (!item.medicine_id) throw new Error('Medicine is required for every purchase item');
    if (!item.batch_number || !item.batch_number.trim()) throw new Error('Batch number is required');
    if (!item.expiry_date) throw new Error('Expiry date is required');
    if (!(item.quantity > 0)) throw new Error('Quantity must be greater than zero');
    if (item.purchase_price < 0) throw new Error('Purchase price cannot be negative');
    if (item.sale_price < 0) throw new Error('Sale price cannot be negative');
  }
}

export function registerPurchaseHandlers() {
  const db = getDatabase();

  const purchaseCreateTx = db.transaction((input: PurchaseInput) => {
    let totalAmount = 0;
    const purchaseInfo = db
      .prepare(
        `INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_amount, notes)
         VALUES (?, ?, ?, 0, ?)`
      )
      .run(input.supplier_id, input.invoice_number, input.purchase_date, input.notes);
    const purchaseId = Number(purchaseInfo.lastInsertRowid);

    const findBatch = db.prepare(
      `SELECT id, quantity FROM batches WHERE medicine_id = ? AND batch_number = ? AND expiry_date = ?`
    );
    const insertBatch = db.prepare(
      `INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, sale_price, quantity)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const updateBatch = db.prepare(
      `UPDATE batches SET quantity = quantity + ?, purchase_price = ?, sale_price = ?, updated_at = datetime('now') WHERE id = ?`
    );
    const insertItem = db.prepare(
      `INSERT INTO purchase_items (purchase_id, medicine_id, batch_id, batch_number, expiry_date, quantity, purchase_price, sale_price, line_total)
       VALUES (@purchase_id, @medicine_id, @batch_id, @batch_number, @expiry_date, @quantity, @purchase_price, @sale_price, @line_total)`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity_change, reference_type, reference_id, reason)
       VALUES (?, ?, 'purchase', ?, 'purchase', ?, ?)`
    );
    const bumpDefaultPrice = db.prepare(`UPDATE medicines SET default_sale_price = ? WHERE id = ?`);

    for (const item of input.items) {
      const existing = findBatch.get(item.medicine_id, item.batch_number, item.expiry_date) as
        | { id: number; quantity: number }
        | undefined;
      let batchId: number;
      if (existing) {
        updateBatch.run(item.quantity, item.purchase_price, item.sale_price, existing.id);
        batchId = existing.id;
      } else {
        const info = insertBatch.run(
          item.medicine_id,
          item.batch_number,
          item.expiry_date,
          item.purchase_price,
          item.sale_price,
          item.quantity
        );
        batchId = Number(info.lastInsertRowid);
      }

      const lineTotal = item.quantity * item.purchase_price;
      totalAmount += lineTotal;

      insertItem.run({
        purchase_id: purchaseId,
        medicine_id: item.medicine_id,
        batch_id: batchId,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        quantity: item.quantity,
        purchase_price: item.purchase_price,
        sale_price: item.sale_price,
        line_total: lineTotal,
      });

      insertMovement.run(item.medicine_id, batchId, item.quantity, purchaseId, 'Stock purchased');
      bumpDefaultPrice.run(item.sale_price, item.medicine_id);
    }

    db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(totalAmount, purchaseId);
    return purchaseId;
  });

  function getPurchaseWithItems(id: number): Purchase | null {
    const purchase = db
      .prepare(
        `SELECT p.*, s.name as supplier_name FROM purchases p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.id = ?`
      )
      .get(id) as Purchase | undefined;
    if (!purchase) return null;
    const items = db
      .prepare(
        `SELECT pi.*, m.name as medicine_name FROM purchase_items pi
         JOIN medicines m ON m.id = pi.medicine_id
         WHERE pi.purchase_id = ? ORDER BY pi.id ASC`
      )
      .all(id) as PurchaseItem[];
    purchase.items = items;
    return purchase;
  }

  ipcMain.handle(IPC.PURCHASES_LIST, (_event, filter?: ListFilter): Purchase[] => {
    let sql = `SELECT p.*, s.name as supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE 1=1`;
    const params: unknown[] = [];
    if (filter?.search) {
      sql += ' AND (p.invoice_number LIKE ? OR s.name LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term);
    }
    if (filter?.start_date) {
      sql += ' AND date(p.purchase_date) >= date(?)';
      params.push(filter.start_date);
    }
    if (filter?.end_date) {
      sql += ' AND date(p.purchase_date) <= date(?)';
      params.push(filter.end_date);
    }
    sql += ' ORDER BY p.purchase_date DESC, p.id DESC';
    return db.prepare(sql).all(...params) as Purchase[];
  });

  ipcMain.handle(IPC.PURCHASES_GET, (_event, id: number) => getPurchaseWithItems(id));

  ipcMain.handle(IPC.PURCHASES_CREATE, (_event, input: PurchaseInput): Purchase => {
    validatePurchaseInput(input);
    const id = purchaseCreateTx(input);
    return getPurchaseWithItems(id) as Purchase;
  });
}
