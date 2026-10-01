import React, { useEffect, useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import type { Medicine, Purchase, PurchaseItemInput, Supplier } from '../../electron/shared/types';

interface CartRow extends PurchaseItemInput {
  key: string;
  medicine_name: string;
}

function emptyRow(): CartRow {
  return {
    key: Math.random().toString(36).slice(2),
    medicine_id: 0,
    medicine_name: '',
    batch_number: '',
    expiry_date: '',
    quantity: 0,
    purchase_price: 0,
    sale_price: 0,
  };
}

function SupplierQuickAdd({ onCreated }: { onCreated: (s: Supplier) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  if (!open) {
    return (
      <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setOpen(true)}>
        + New supplier
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      <input className="input" placeholder="Supplier name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          if (!name.trim()) return;
          const supplier = await window.api.suppliers.create({
            name: name.trim(),
            contact_person: null,
            phone: phone || null,
            email: null,
            address: null,
            notes: null,
            is_active: 1,
          });
          onCreated(supplier);
          setOpen(false);
          setName('');
          setPhone('');
        }}
      >
        Add
      </button>
    </div>
  );
}

function NewPurchaseModal({
  suppliers,
  onClose,
  onSaved,
  onSupplierCreated,
}: {
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
  onSupplierCreated: (s: Supplier) => void;
}) {
  const toast = useToast();
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<CartRow[]>([emptyRow()]);
  const [medicineQuery, setMedicineQuery] = useState('');
  const [medicineResults, setMedicineResults] = useState<Medicine[]>([]);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!medicineQuery.trim()) {
      setMedicineResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const results = await window.api.medicines.list({ search: medicineQuery, limit: 8 });
      setMedicineResults(results);
    }, 200);
    return () => clearTimeout(t);
  }, [medicineQuery]);

  function updateRow(key: string, patch: Partial<CartRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function selectMedicineForRow(key: string, medicine: Medicine) {
    updateRow(key, {
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      sale_price: medicine.default_sale_price,
    });
    setMedicineQuery('');
    setMedicineResults([]);
    setActiveRowKey(null);
  }

  const total = rows.reduce((sum, r) => sum + r.quantity * r.purchase_price, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const items = rows.filter((r) => r.medicine_id && r.quantity > 0);
    if (items.length === 0) {
      setError('Add at least one valid item');
      return;
    }
    setSaving(true);
    try {
      await window.api.purchases.create({
        supplier_id: supplierId === '' ? null : Number(supplierId),
        invoice_number: invoiceNumber || null,
        purchase_date: purchaseDate,
        notes: notes || null,
        items: items.map(({ medicine_id, batch_number, expiry_date, quantity, purchase_price, sale_price }) => ({
          medicine_id,
          batch_number,
          expiry_date,
          quantity,
          purchase_price,
          sale_price,
        })),
      });
      toast.show('Purchase recorded and stock updated', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save purchase');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Record Purchase" onClose={onClose} width="xl">
      <form id="purchase-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Select supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <SupplierQuickAdd
              onCreated={(s) => {
                onSupplierCreated(s);
                setSupplierId(s.id);
              }}
            />
          </div>
          <div>
            <label className="label">Invoice Number</label>
            <input className="input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <label className="label">Purchase Date</label>
            <input type="date" className="input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Items</h3>
            <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setRows((r) => [...r, emptyRow()])}>
              + Add Row
            </button>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-56">Medicine</th>
                <th>Batch #</th>
                <th>Expiry</th>
                <th>Qty</th>
                <th>Cost</th>
                <th>MRP</th>
                <th>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="relative">
                    <input
                      className="input"
                      placeholder="Search medicine…"
                      value={activeRowKey === row.key ? medicineQuery : row.medicine_name}
                      onFocus={() => {
                        setActiveRowKey(row.key);
                        setMedicineQuery('');
                      }}
                      onChange={(e) => setMedicineQuery(e.target.value)}
                    />
                    {activeRowKey === row.key && medicineResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg">
                        {medicineResults.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => selectMedicineForRow(row.key, m)}
                          >
                            {m.name} <span className="text-xs text-slate-400">{m.generic_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      className="input"
                      value={row.batch_number}
                      onChange={(e) => updateRow(row.key, { batch_number: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className="input"
                      value={row.expiry_date}
                      onChange={(e) => updateRow(row.key, { expiry_date: e.target.value })}
                    />
                  </td>
                  <td className="w-24">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input"
                      value={row.quantity || ''}
                      onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td className="w-28">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input"
                      value={row.purchase_price || ''}
                      onChange={(e) => updateRow(row.key, { purchase_price: Number(e.target.value) })}
                    />
                  </td>
                  <td className="w-28">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input"
                      value={row.sale_price || ''}
                      onChange={(e) => updateRow(row.key, { sale_price: Number(e.target.value) })}
                    />
                  </td>
                  <td className="whitespace-nowrap text-sm">{(row.quantity * row.purchase_price).toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-right text-sm font-semibold text-slate-700">Total: {total.toFixed(2)}</div>
        </div>
      </form>

      <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" form="purchase-form" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Purchase'}
        </button>
      </div>
    </Modal>
  );
}

export default function Purchases() {
  const { formatCurrency } = useSettings();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Purchase | null>(null);

  async function load() {
    setLoading(true);
    const [p, s] = await Promise.all([window.api.purchases.list({ search }), window.api.suppliers.list()]);
    setPurchases(p);
    setSuppliers(s);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function openDetail(p: Purchase) {
    const full = await window.api.purchases.get(p.id);
    setViewing(full);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <input
          className="input max-w-sm"
          placeholder="Search by invoice number or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-primary" onClick={() => setFormOpen(true)}>
          + Record Purchase
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Supplier</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No purchases recorded yet.
                </td>
              </tr>
            ) : (
              purchases.map((p) => (
                <tr key={p.id}>
                  <td>{p.purchase_date}</td>
                  <td>{p.invoice_number ?? '—'}</td>
                  <td>{p.supplier_name ?? '—'}</td>
                  <td>{formatCurrency(p.total_amount)}</td>
                  <td className="text-right">
                    <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => openDetail(p)}>
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <NewPurchaseModal
          suppliers={suppliers}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
          onSupplierCreated={(s) => setSuppliers((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {viewing && (
        <Modal title={`Purchase · ${viewing.invoice_number ?? viewing.id}`} onClose={() => setViewing(null)} width="lg">
          <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400">Supplier</div>
              <div>{viewing.supplier_name ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Date</div>
              <div>{viewing.purchase_date}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Total</div>
              <div className="font-semibold">{formatCurrency(viewing.total_amount)}</div>
            </div>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Qty</th>
                <th>Cost</th>
                <th>MRP</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {viewing.items?.map((item) => (
                <tr key={item.id}>
                  <td>{item.medicine_name}</td>
                  <td>{item.batch_number}</td>
                  <td>{item.expiry_date}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.purchase_price)}</td>
                  <td>{formatCurrency(item.sale_price)}</td>
                  <td>{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
