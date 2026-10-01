import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import type { Batch, Category, Medicine, MedicineInput, Unit } from '../../electron/shared/types';

const UNITS: Unit[] = ['tablet', 'strip', 'bottle', 'box', 'other'];

interface OpeningStock {
  batch_number: string;
  expiry_date: string;
  purchase_price: string;
  sale_price: string;
  quantity: string;
}

const emptyOpeningStock: OpeningStock = {
  batch_number: '',
  expiry_date: '',
  purchase_price: '',
  sale_price: '',
  quantity: '',
};

function emptyMedicineInput(): MedicineInput {
  return {
    name: '',
    generic_name: '',
    category_id: null,
    manufacturer: '',
    unit: 'tablet',
    reorder_level: 10,
    default_sale_price: 0,
    is_active: 1,
  };
}

function MedicineFormModal({
  medicine,
  categories,
  onClose,
  onSaved,
  onCategoryCreated,
}: {
  medicine: Medicine | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  onCategoryCreated: (c: Category) => void;
}) {
  const { formatCurrency } = useSettings();
  const toast = useToast();
  const isEdit = Boolean(medicine);
  const [form, setForm] = useState<MedicineInput>(() =>
    medicine
      ? {
          name: medicine.name,
          generic_name: medicine.generic_name,
          category_id: medicine.category_id,
          manufacturer: medicine.manufacturer,
          unit: medicine.unit,
          reorder_level: medicine.reorder_level,
          default_sale_price: medicine.default_sale_price,
          is_active: medicine.is_active,
        }
      : emptyMedicineInput()
  );
  const [opening, setOpening] = useState<OpeningStock>(emptyOpeningStock);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    if (medicine) {
      window.api.medicines.batches(medicine.id).then(setBatches);
    }
  }, [medicine]);

  const purchasePriceNum = Number(opening.purchase_price) || 0;
  const salePriceNum = isEdit ? medicine!.default_sale_price : Number(opening.sale_price) || 0;
  const profitAmount = salePriceNum - purchasePriceNum;
  const profitPercent = purchasePriceNum > 0 ? (profitAmount / purchasePriceNum) * 100 : 0;

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    const cat = await window.api.categories.create(newCategoryName.trim());
    onCategoryCreated(cat);
    setForm((f) => ({ ...f, category_id: cat.id }));
    setNewCategoryName('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let savedMedicine: Medicine;
      if (isEdit) {
        savedMedicine = await window.api.medicines.update(medicine!.id, form);
      } else {
        savedMedicine = await window.api.medicines.create(form);
      }

      if (!isEdit && opening.batch_number && opening.expiry_date && opening.quantity) {
        await window.api.purchases.create({
          supplier_id: null,
          invoice_number: 'OPENING-STOCK',
          purchase_date: new Date().toISOString().slice(0, 10),
          notes: 'Opening stock added while creating medicine',
          items: [
            {
              medicine_id: savedMedicine.id,
              batch_number: opening.batch_number,
              expiry_date: opening.expiry_date,
              quantity: Number(opening.quantity),
              purchase_price: Number(opening.purchase_price) || 0,
              sale_price: Number(opening.sale_price) || form.default_sale_price,
            },
          ],
        });
      }

      toast.show(isEdit ? 'Medicine updated' : 'Medicine added', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save medicine');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Medicine' : 'Add Medicine'} onClose={onClose} width="lg">
      <form id="medicine-form" onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Generic Name</label>
            <input
              className="input"
              value={form.generic_name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, generic_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <div className="flex gap-2">
              <select
                className="input"
                value={form.category_id ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-1 flex gap-2">
              <input
                className="input"
                placeholder="New category…"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button type="button" className="btn-secondary shrink-0" onClick={handleCreateCategory}>
                Add
              </button>
            </div>
          </div>
          <div>
            <label className="label">Manufacturer</label>
            <input
              className="input"
              value={form.manufacturer ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Unit *</label>
            <select className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as Unit }))}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reorder Level (low-stock threshold) *</label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={form.reorder_level}
              onChange={(e) => setForm((f) => ({ ...f, reorder_level: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Sale Price / MRP *</label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={form.default_sale_price}
              onChange={(e) => setForm((f) => ({ ...f, default_sale_price: Number(e.target.value) }))}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.is_active === 1}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
              />
              Active
            </label>
          </div>
        </div>

        {!isEdit && (
          <div className="rounded-xl border border-dashed border-slate-300 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Opening Stock (optional)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Batch Number</label>
                <input
                  className="input"
                  value={opening.batch_number}
                  onChange={(e) => setOpening((o) => ({ ...o, batch_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Expiry Date</label>
                <input
                  type="date"
                  className="input"
                  value={opening.expiry_date}
                  onChange={(e) => setOpening((o) => ({ ...o, expiry_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Quantity</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={opening.quantity}
                  onChange={(e) => setOpening((o) => ({ ...o, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Purchase Price (cost)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={opening.purchase_price}
                  onChange={(e) => setOpening((o) => ({ ...o, purchase_price: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Sale Price (MRP)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={opening.sale_price}
                  onChange={(e) => setOpening((o) => ({ ...o, sale_price: e.target.value }))}
                  placeholder={String(form.default_sale_price)}
                />
              </div>
              <div className="flex flex-col justify-center rounded-lg bg-brand-50 px-3 py-2">
                <span className="text-xs text-brand-700">Profit Margin</span>
                <span className="text-sm font-semibold text-brand-800">
                  {formatCurrency(profitAmount)} ({profitPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {isEdit && batches.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Existing Batches</h3>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Expiry</th>
                  <th>Qty</th>
                  <th>Cost</th>
                  <th>MRP</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const margin = b.sale_price - b.purchase_price;
                  const marginPct = b.purchase_price > 0 ? (margin / b.purchase_price) * 100 : 0;
                  return (
                    <tr key={b.id}>
                      <td>{b.batch_number}</td>
                      <td>{b.expiry_date}</td>
                      <td>{b.quantity}</td>
                      <td>{formatCurrency(b.purchase_price)}</td>
                      <td>{formatCurrency(b.sale_price)}</td>
                      <td>
                        {formatCurrency(margin)} ({marginPct.toFixed(1)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-400">
              To add more stock to this medicine, use the Purchases module. To write off or adjust a batch, use the Stock Ledger.
            </p>
          </div>
        )}
      </form>

      <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" form="medicine-form" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

export default function Medicines() {
  const { formatCurrency } = useSettings();
  const toast = useToast();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [deleting, setDeleting] = useState<Medicine | null>(null);

  async function load() {
    setLoading(true);
    const [meds, cats] = await Promise.all([window.api.medicines.list({ search }), window.api.categories.list()]);
    setMedicines(meds);
    setCategories(cats);
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

  async function handleDelete() {
    if (!deleting) return;
    const result = await window.api.medicines.remove(deleting.id);
    toast.show(result.message ?? 'Medicine removed', result.success ? 'success' : 'error');
    setDeleting(null);
    load();
  }

  const lowStockIds = useMemo(
    () => new Set(medicines.filter((m) => (m.total_stock ?? 0) <= m.reorder_level).map((m) => m.id)),
    [medicines]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <input
          className="input max-w-sm"
          placeholder="Search by name, generic name, manufacturer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + Add Medicine
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Manufacturer</th>
              <th>Unit</th>
              <th>Stock</th>
              <th>MRP</th>
              <th>Stock Value (Cost)</th>
              <th>Nearest Expiry</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : medicines.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-400">
                  No medicines found.
                </td>
              </tr>
            ) : (
              medicines.map((m) => (
                <tr key={m.id} className={m.is_active ? '' : 'opacity-50'}>
                  <td className="font-medium text-slate-800">
                    {m.name}
                    {m.generic_name && <div className="text-xs text-slate-400">{m.generic_name}</div>}
                  </td>
                  <td>{m.category_name ?? '—'}</td>
                  <td>{m.manufacturer ?? '—'}</td>
                  <td>{m.unit}</td>
                  <td className={lowStockIds.has(m.id) ? 'font-semibold text-amber-600' : ''}>
                    {m.total_stock ?? 0}
                  </td>
                  <td>{formatCurrency(m.default_sale_price)}</td>
                  <td>{formatCurrency(m.stock_value_cost ?? 0)}</td>
                  <td>{m.nearest_expiry ?? '—'}</td>
                  <td className="text-right">
                    <button
                      className="mr-3 text-xs font-medium text-brand-600 hover:underline"
                      onClick={() => {
                        setEditing(m);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => setDeleting(m)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <MedicineFormModal
          medicine={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
          onCategoryCreated={(c) => setCategories((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete Medicine"
          message={`Are you sure you want to delete "${deleting.name}"? If it has purchase or sale history it will be deactivated instead.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
