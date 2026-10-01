import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { Sale, SaleInput, SaleItem, Medicine, Batch, DiscountType } from '../shared/types';
import type { ListFilter } from '../shared/api-types';
import { escapeHtml, printHtml } from '../printing';

function validateSaleInput(input: SaleInput) {
  if (!input.items || input.items.length === 0) throw new Error('Cart is empty');
  for (const item of input.items) {
    if (!item.medicine_id) throw new Error('Medicine is required for every line item');
    if (!(item.quantity > 0)) throw new Error('Quantity must be greater than zero');
    if (item.unit_sale_price < 0) throw new Error('Sale price cannot be negative');
  }
}

function computeDiscountAmount(base: number, type: DiscountType, value: number): number {
  if (type === 'percent') return Math.min(base, base * (value / 100));
  if (type === 'fixed') return Math.min(base, Math.max(0, value));
  return 0;
}

function getSetting(db: ReturnType<typeof getDatabase>, key: string, fallback: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function registerSaleHandlers() {
  const db = getDatabase();

  function generateInvoiceNumber(): string {
    const prefix = getSetting(db, 'invoice_prefix', 'INV');
    const row = db.prepare('SELECT COUNT(*) as c FROM sales').get() as { c: number };
    const seq = row.c + 1;
    return `${prefix}-${String(seq).padStart(6, '0')}`;
  }

  const saleCreateTx = db.transaction((input: SaleInput, invoiceNumber: string) => {
    const findBatches = db.prepare(
      `SELECT id, batch_number, purchase_price, quantity FROM batches
       WHERE medicine_id = ? AND quantity > 0 ORDER BY date(expiry_date) ASC, id ASC`
    );
    const decrementBatch = db.prepare(`UPDATE batches SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?`);
    const insertSaleItem = db.prepare(
      `INSERT INTO sale_items
        (sale_id, medicine_id, batch_id, batch_number, quantity, unit_sale_price, unit_cost_price, discount_type, discount_value, discount_amount, line_total)
       VALUES (@sale_id, @medicine_id, @batch_id, @batch_number, @quantity, @unit_sale_price, @unit_cost_price, @discount_type, @discount_value, @discount_amount, @line_total)`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity_change, reference_type, reference_id, reason)
       VALUES (?, ?, 'sale', ?, 'sale', ?, 'Stock sold')`
    );
    const medicineExists = db.prepare('SELECT name FROM medicines WHERE id = ?');

    let subtotal = 0;
    let itemDiscountTotal = 0;
    let totalCost = 0;

    // Reserve the sale row first so we have an id for FK references.
    const saleInfo = db
      .prepare(
        `INSERT INTO sales
          (invoice_number, customer_name, customer_phone, subtotal, discount_type, discount_value, discount_amount, total_amount, total_cost, profit_amount, payment_method, notes)
         VALUES (?, ?, ?, 0, ?, ?, 0, 0, 0, 0, ?, ?)`
      )
      .run(
        invoiceNumber,
        input.customer_name,
        input.customer_phone,
        input.discount_type,
        input.discount_value,
        input.payment_method,
        input.notes
      );
    const saleId = Number(saleInfo.lastInsertRowid);

    for (const item of input.items) {
      const medicine = medicineExists.get(item.medicine_id) as { name: string } | undefined;
      if (!medicine) throw new Error(`Medicine #${item.medicine_id} not found`);

      const itemGross = item.quantity * item.unit_sale_price;
      const itemDiscountAmount = computeDiscountAmount(itemGross, item.discount_type, item.discount_value);
      subtotal += itemGross;
      itemDiscountTotal += itemDiscountAmount;

      const batches = findBatches.all(item.medicine_id) as {
        id: number;
        batch_number: string;
        purchase_price: number;
        quantity: number;
      }[];
      const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
      if (totalAvailable < item.quantity) {
        throw new Error(
          `Insufficient stock for ${medicine.name}. Available: ${totalAvailable}, requested: ${item.quantity}`
        );
      }

      let remaining = item.quantity;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.quantity);
        if (take <= 0) continue;

        const portionOfLine = take / item.quantity;
        const splitDiscount = itemDiscountAmount * portionOfLine;
        const splitGross = take * item.unit_sale_price;
        const splitLineTotal = splitGross - splitDiscount;
        const splitCost = take * batch.purchase_price;
        totalCost += splitCost;

        insertSaleItem.run({
          sale_id: saleId,
          medicine_id: item.medicine_id,
          batch_id: batch.id,
          batch_number: batch.batch_number,
          quantity: take,
          unit_sale_price: item.unit_sale_price,
          unit_cost_price: batch.purchase_price,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          discount_amount: splitDiscount,
          line_total: splitLineTotal,
        });

        decrementBatch.run(take, batch.id);
        insertMovement.run(item.medicine_id, batch.id, -take, saleId);

        remaining -= take;
      }
    }

    const afterItemDiscount = subtotal - itemDiscountTotal;
    const invoiceDiscountAmount = computeDiscountAmount(afterItemDiscount, input.discount_type, input.discount_value);
    const totalAmount = afterItemDiscount - invoiceDiscountAmount;
    const profitAmount = totalAmount - totalCost;

    db.prepare(
      `UPDATE sales SET subtotal = ?, discount_amount = ?, total_amount = ?, total_cost = ?, profit_amount = ? WHERE id = ?`
    ).run(subtotal, invoiceDiscountAmount, totalAmount, totalCost, profitAmount, saleId);

    return saleId;
  });

  function getSaleWithItems(id: number): Sale | null {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as Sale | undefined;
    if (!sale) return null;
    const items = db
      .prepare(
        `SELECT si.*, m.name as medicine_name FROM sale_items si
         JOIN medicines m ON m.id = si.medicine_id
         WHERE si.sale_id = ? ORDER BY si.id ASC`
      )
      .all(id) as SaleItem[];
    sale.items = items;
    return sale;
  }

  ipcMain.handle(IPC.SALES_LIST, (_event, filter?: ListFilter): Sale[] => {
    let sql = 'SELECT * FROM sales WHERE 1=1';
    const params: unknown[] = [];
    if (filter?.search) {
      sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term);
    }
    if (filter?.start_date) {
      sql += ' AND date(sale_date) >= date(?)';
      params.push(filter.start_date);
    }
    if (filter?.end_date) {
      sql += ' AND date(sale_date) <= date(?)';
      params.push(filter.end_date);
    }
    sql += ' ORDER BY sale_date DESC, id DESC';
    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
      if (filter?.offset) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }
    }
    return db.prepare(sql).all(...params) as Sale[];
  });

  ipcMain.handle(IPC.SALES_GET, (_event, id: number) => getSaleWithItems(id));

  ipcMain.handle(IPC.SALES_CREATE, (_event, input: SaleInput): Sale => {
    validateSaleInput(input);
    const invoiceNumber = generateInvoiceNumber();
    const id = saleCreateTx(input, invoiceNumber);
    return getSaleWithItems(id) as Sale;
  });

  ipcMain.handle(IPC.SALES_NEXT_INVOICE, () => generateInvoiceNumber());

  ipcMain.handle(IPC.SALES_SEARCH_MEDICINES, (_event, query: string) => {
    const term = `%${query ?? ''}%`;
    const medicines = db
      .prepare(
        `SELECT m.*, COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.medicine_id = m.id), 0) as total_stock
         FROM medicines m
         WHERE m.is_active = 1 AND (m.name LIKE ? OR m.generic_name LIKE ?)
         ORDER BY m.name ASC LIMIT 25`
      )
      .all(term, term) as Medicine[];

    const batchStmt = db.prepare(
      `SELECT * FROM batches WHERE medicine_id = ? AND quantity > 0 ORDER BY date(expiry_date) ASC`
    );
    return medicines.map((m) => ({ ...m, batches: batchStmt.all(m.id) as Batch[] }));
  });

  ipcMain.handle(IPC.SALES_PRINT_RECEIPT, async (_event, saleId: number) => {
    const sale = getSaleWithItems(saleId);
    if (!sale) return { success: false, message: 'Sale not found' };

    const pharmacyName = getSetting(db, 'pharmacy_name', 'My Pharmacy');
    const pharmacyAddress = getSetting(db, 'pharmacy_address', '');
    const pharmacyPhone = getSetting(db, 'pharmacy_phone', '');
    const currency = getSetting(db, 'currency_symbol', '₹');
    const footer = getSetting(db, 'receipt_footer_note', '');

    const rows = (sale.items ?? [])
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.medicine_name)}${item.batch_number ? ` <span class="muted">(${escapeHtml(item.batch_number)})</span>` : ''}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${currency}${item.unit_sale_price.toFixed(2)}</td>
          <td class="num">${currency}${item.discount_amount.toFixed(2)}</td>
          <td class="num">${currency}${item.line_total.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html>
      <html><head><meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 16px; width: 320px; }
        h1 { font-size: 16px; margin: 0 0 2px; }
        .muted { color: #666; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 3px 2px; font-size: 11px; }
        th { border-bottom: 1px solid #333; }
        td.num, th.num { text-align: right; }
        .totals td { border-top: 1px solid #333; font-weight: bold; }
        .center { text-align: center; }
      </style></head>
      <body>
        <div class="center">
          <h1>${escapeHtml(pharmacyName)}</h1>
          <div class="muted">${escapeHtml(pharmacyAddress)}</div>
          <div class="muted">${escapeHtml(pharmacyPhone)}</div>
        </div>
        <hr />
        <div>Invoice: <strong>${escapeHtml(sale.invoice_number)}</strong></div>
        <div class="muted">${escapeHtml(sale.sale_date)}</div>
        ${sale.customer_name ? `<div class="muted">Customer: ${escapeHtml(sale.customer_name)}</div>` : ''}
        <table>
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Disc</th><th class="num">Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="totals"><td colspan="4">Subtotal</td><td class="num">${currency}${sale.subtotal.toFixed(2)}</td></tr>
            <tr><td colspan="4">Invoice Discount</td><td class="num">${currency}${sale.discount_amount.toFixed(2)}</td></tr>
            <tr class="totals"><td colspan="4">Total</td><td class="num">${currency}${sale.total_amount.toFixed(2)}</td></tr>
          </tfoot>
        </table>
        <div class="center muted" style="margin-top: 14px;">${escapeHtml(footer)}</div>
      </body></html>`;

    return printHtml(html);
  });
}
