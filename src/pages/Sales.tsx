import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import type { Batch, DiscountType, Medicine, Sale } from '../../electron/shared/types';

interface CartLine {
  key: string;
  medicine_id: number;
  medicine_name: string;
  available_stock: number;
  unit: string;
  quantity: number;
  unit_sale_price: number;
  discount_type: DiscountType;
  discount_value: number;
}

function lineGross(line: CartLine) {
  return line.quantity * line.unit_sale_price;
}

function lineDiscount(line: CartLine) {
  const gross = lineGross(line);
  if (line.discount_type === 'percent') return Math.min(gross, gross * (line.discount_value / 100));
  if (line.discount_type === 'fixed') return Math.min(gross, Math.max(0, line.discount_value));
  return 0;
}

function lineTotal(line: CartLine) {
  return lineGross(line) - lineDiscount(line);
}

export default function Sales() {
  const { formatCurrency } = useSettings();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Medicine & { batches: Batch[] })[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'other'>('cash');
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<DiscountType>('none');
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState(0);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const [recent, setRecent] = useState<Sale[]>([]);

  useEffect(() => {
    window.api.sales.list({ limit: 8 }).then(setRecent);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await window.api.sales.searchMedicines(query);
      setResults(r);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function addToCart(medicine: Medicine & { batches: Batch[] }) {
    const availableStock = medicine.batches.reduce((s, b) => s + b.quantity, 0);
    if (availableStock <= 0) {
      toast.show(`${medicine.name} is out of stock`, 'error');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.medicine_id === medicine.id);
      if (existing) {
        return prev.map((l) =>
          l.medicine_id === medicine.id ? { ...l, quantity: Math.min(l.quantity + 1, availableStock) } : l
        );
      }
      const price = medicine.batches[0]?.sale_price ?? medicine.default_sale_price;
      return [
        ...prev,
        {
          key: Math.random().toString(36).slice(2),
          medicine_id: medicine.id,
          medicine_name: medicine.name,
          available_stock: availableStock,
          unit: medicine.unit,
          quantity: 1,
          unit_sale_price: price,
          discount_type: 'none',
          discount_value: 0,
        },
      ];
    });
    setQuery('');
    setResults([]);
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const subtotal = useMemo(() => cart.reduce((s, l) => s + lineGross(l), 0), [cart]);
  const itemDiscountTotal = useMemo(() => cart.reduce((s, l) => s + lineDiscount(l), 0), [cart]);
  const afterItemDiscount = subtotal - itemDiscountTotal;
  const invoiceDiscountAmount =
    invoiceDiscountType === 'percent'
      ? Math.min(afterItemDiscount, afterItemDiscount * (invoiceDiscountValue / 100))
      : invoiceDiscountType === 'fixed'
      ? Math.min(afterItemDiscount, Math.max(0, invoiceDiscountValue))
      : 0;
  const grandTotal = afterItemDiscount - invoiceDiscountAmount;

  function resetSaleForm() {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setInvoiceDiscountType('none');
    setInvoiceDiscountValue(0);
    setNotes('');
  }

  async function completeSale() {
    setError('');
    if (cart.length === 0) {
      setError('Cart is empty');
      return;
    }
    setSubmitting(true);
    try {
      const sale = await window.api.sales.create({
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        discount_type: invoiceDiscountType,
        discount_value: invoiceDiscountValue,
        payment_method: paymentMethod,
        notes: notes || null,
        items: cart.map((l) => ({
          medicine_id: l.medicine_id,
          quantity: l.quantity,
          unit_sale_price: l.unit_sale_price,
          discount_type: l.discount_type,
          discount_value: l.discount_value,
        })),
      });
      toast.show(`Sale ${sale.invoice_number} completed`, 'success');
      setLastSale(sale);
      resetSaleForm();
      window.api.sales.list({ limit: 8 }).then(setRecent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete sale');
    } finally {
      setSubmitting(false);
    }
  }

  async function printReceipt(saleId: number) {
    const result = await window.api.sales.printReceipt(saleId);
    if (!result.success) toast.show(result.message ?? 'Print failed', 'error');
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2 space-y-4">
        <div className="card p-4">
          <div className="relative">
            <input
              className="input"
              placeholder="Search medicine to add to cart…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {results.map((m) => {
                  const stock = m.batches.reduce((s, b) => s + b.quantity, 0);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
                      disabled={stock <= 0}
                      onClick={() => addToCart(m)}
                    >
                      <span>
                        {m.name} <span className="text-xs text-slate-400">{m.generic_name}</span>
                      </span>
                      <span className="text-xs text-slate-400">
                        {stock} {m.unit} · {formatCurrency(m.default_sale_price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Discount</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Cart is empty. Search above to add items.
                  </td>
                </tr>
              ) : (
                cart.map((line) => (
                  <tr key={line.key}>
                    <td className="font-medium text-slate-800">
                      {line.medicine_name}
                      <div className="text-xs text-slate-400">Stock: {line.available_stock}</div>
                    </td>
                    <td className="w-24">
                      <input
                        type="number"
                        min={1}
                        max={line.available_stock}
                        className="input"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: Math.min(Number(e.target.value), line.available_stock) })
                        }
                      />
                    </td>
                    <td className="w-28">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input"
                        value={line.unit_sale_price}
                        onChange={(e) => updateLine(line.key, { unit_sale_price: Number(e.target.value) })}
                      />
                    </td>
                    <td className="w-40">
                      <div className="flex gap-1">
                        <select
                          className="input"
                          value={line.discount_type}
                          onChange={(e) => updateLine(line.key, { discount_type: e.target.value as DiscountType })}
                        >
                          <option value="none">None</option>
                          <option value="fixed">₹</option>
                          <option value="percent">%</option>
                        </select>
                        {line.discount_type !== 'none' && (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input"
                            value={line.discount_value}
                            onChange={(e) => updateLine(line.key, { discount_value: Number(e.target.value) })}
                          />
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap font-medium">{formatCurrency(lineTotal(line))}</td>
                    <td>
                      <button className="text-red-500 hover:text-red-700" onClick={() => removeLine(line.key)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Recent Sales</h3>
          <table className="table-base">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td>{s.invoice_number}</td>
                  <td>{s.sale_date}</td>
                  <td>{formatCurrency(s.total_amount)}</td>
                  <td className="text-right">
                    <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => printReceipt(s.id)}>
                      Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card h-fit space-y-4 p-4">
        <h3 className="text-sm font-semibold text-slate-700">Checkout</h3>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Customer Name</label>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="label">Invoice Discount</label>
          <div className="flex gap-2">
            <select className="input" value={invoiceDiscountType} onChange={(e) => setInvoiceDiscountType(e.target.value as DiscountType)}>
              <option value="none">None</option>
              <option value="fixed">Fixed</option>
              <option value="percent">Percent</option>
            </select>
            {invoiceDiscountType !== 'none' && (
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={invoiceDiscountValue}
                onChange={(e) => setInvoiceDiscountValue(Number(e.target.value))}
              />
            )}
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Item Discounts</span>
            <span>-{formatCurrency(itemDiscountTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Invoice Discount</span>
            <span>-{formatCurrency(invoiceDiscountAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-800">
            <span>Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <button className="btn-primary w-full" disabled={submitting || cart.length === 0} onClick={completeSale}>
          {submitting ? 'Processing…' : `Complete Sale · ${formatCurrency(grandTotal)}`}
        </button>
      </div>

      {lastSale && (
        <Modal title="Sale Completed" onClose={() => setLastSale(null)} width="sm">
          <p className="text-sm text-slate-600">
            Invoice <strong>{lastSale.invoice_number}</strong> for {formatCurrency(lastSale.total_amount)} was saved.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setLastSale(null)}>
              Close
            </button>
            <button className="btn-primary" onClick={() => printReceipt(lastSale.id)}>
              Print Receipt
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
