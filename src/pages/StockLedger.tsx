import React, { useEffect, useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import type { Batch, LowStockItem, Medicine, NearExpiryItem, StockMovement } from '../../electron/shared/types';

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'Purchase (IN)',
  sale: 'Sale (OUT)',
  return_in: 'Customer Return (IN)',
  return_out: 'Return to Supplier (OUT)',
  damage: 'Damage (OUT)',
  expiry_writeoff: 'Expiry Write-off (OUT)',
  adjustment: 'Adjustment',
};

function AdjustStockModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Medicine[]>([]);
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<number | ''>('');
  const [movementType, setMovementType] = useState<'damage' | 'expiry_writeoff' | 'return_in' | 'return_out'>('damage');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setResults(await window.api.medicines.list({ search: query, limit: 8 }));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  async function selectMedicine(m: Medicine) {
    setMedicine(m);
    setQuery('');
    setResults([]);
    const b = await window.api.medicines.batches(m.id);
    setBatches(b);
    setBatchId(b[0]?.id ?? '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!medicine || !batchId) {
      setError('Select a medicine and batch');
      return;
    }
    if (!(quantity > 0)) {
      setError('Quantity must be greater than zero');
      return;
    }
    setSaving(true);
    const result = await window.api.stock.adjust({
      medicine_id: medicine.id,
      batch_id: Number(batchId),
      movement_type: movementType,
      quantity,
      reason,
    });
    setSaving(false);
    if (result.success) {
      toast.show('Stock adjusted', 'success');
      onSaved();
    } else {
      setError(result.message ?? 'Failed to adjust stock');
    }
  }

  return (
    <Modal title="Manual Stock Adjustment" onClose={onClose} width="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="relative">
          <label className="label">Medicine</label>
          <input
            className="input"
            placeholder="Search medicine…"
            value={medicine ? medicine.name : query}
            onChange={(e) => {
              setMedicine(null);
              setQuery(e.target.value);
            }}
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
              {results.map((m) => (
                <button key={m.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => selectMedicine(m)}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {medicine && (
          <div>
            <label className="label">Batch</label>
            <select className="input" value={batchId} onChange={(e) => setBatchId(Number(e.target.value))}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} · exp {b.expiry_date} · qty {b.quantity}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Movement Type</label>
            <select className="input" value={movementType} onChange={(e) => setMovementType(e.target.value as any)}>
              <option value="damage">Damage (remove stock)</option>
              <option value="expiry_writeoff">Expiry Write-off (remove stock)</option>
              <option value="return_out">Return to Supplier (remove stock)</option>
              <option value="return_in">Customer Return (add stock back)</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" min={0} step="0.01" className="input" value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="label">Reason *</label>
          <input required className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Bottle broken during handling" />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function StockLedger() {
  const toast = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [nearExpiry, setNearExpiry] = useState<NearExpiryItem[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ledger' | 'low' | 'expiry'>('ledger');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [m, l, e] = await Promise.all([
      window.api.stock.movements({ search, limit: 100 }),
      window.api.stock.lowStock(),
      window.api.stock.nearExpiry(),
    ]);
    setMovements(m);
    setLowStock(l);
    setNearExpiry(e);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {(['ledger', 'low', 'expiry'] as const).map((t) => (
            <button
              key={t}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
              onClick={() => setTab(t)}
            >
              {t === 'ledger' ? 'Movement Ledger' : t === 'low' ? `Low Stock (${lowStock.length})` : `Near Expiry (${nearExpiry.length})`}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setAdjustOpen(true)}>
          + Manual Adjustment
        </button>
      </div>

      {tab === 'ledger' && (
        <div className="space-y-3">
          <input className="input max-w-sm" placeholder="Search by medicine or reason…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Type</th>
                  <th>Qty Change</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No stock movements yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td>{m.movement_date}</td>
                      <td>{m.medicine_name}</td>
                      <td>{m.batch_number ?? '—'}</td>
                      <td>{MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}</td>
                      <td className={m.quantity_change >= 0 ? 'text-brand-700 font-medium' : 'text-red-600 font-medium'}>
                        {m.quantity_change >= 0 ? '+' : ''}
                        {m.quantity_change}
                      </td>
                      <td>{m.reason ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'low' && (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Current Stock</th>
                <th>Reorder Level</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400">
                    Nothing is running low.
                  </td>
                </tr>
              ) : (
                lowStock.map((item) => (
                  <tr key={item.medicine_id}>
                    <td>{item.medicine_name}</td>
                    <td className="font-semibold text-amber-600">
                      {item.total_stock} {item.unit}
                    </td>
                    <td>{item.reorder_level}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'expiry' && (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expiry Date</th>
                <th>Qty</th>
                <th>Days Left</th>
              </tr>
            </thead>
            <tbody>
              {nearExpiry.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No batches expiring soon.
                  </td>
                </tr>
              ) : (
                nearExpiry.map((item) => (
                  <tr key={item.batch_id}>
                    <td>{item.medicine_name}</td>
                    <td>{item.batch_number}</td>
                    <td>{item.expiry_date}</td>
                    <td>{item.quantity}</td>
                    <td className={item.days_to_expiry <= 30 ? 'font-semibold text-red-600' : 'font-semibold text-amber-600'}>
                      {item.days_to_expiry}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {adjustOpen && (
        <AdjustStockModal
          onClose={() => setAdjustOpen(false)}
          onSaved={() => {
            setAdjustOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
