import React, { useEffect, useState } from 'react';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { Settings as SettingsType } from '../../electron/shared/types';

export default function Settings() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const [form, setForm] = useState<SettingsType>(settings);
  const [saving, setSaving] = useState(false);
  const [dbPath, setDbPath] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  useEffect(() => setForm(settings), [settings]);
  useEffect(() => {
    window.api.backup.getPath().then(setDbPath);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update(form);
      toast.show('Settings saved', 'success');
    } finally {
      setSaving(false);
    }
  }

  async function handlePickLogo() {
    const result = await window.api.settings.pickLogo();
    if (result.success && result.path) setForm((f) => ({ ...f, pharmacy_logo_path: result.path! }));
  }

  async function handleBackup() {
    const result = await window.api.backup.export();
    if (result.success) toast.show(`Backup saved to ${result.path}`, 'success');
    else if (result.message !== 'Backup cancelled') toast.show(result.message ?? 'Backup failed', 'error');
  }

  async function handleRestore() {
    setRestoreConfirm(false);
    const result = await window.api.backup.restore();
    if (result.success) {
      toast.show('Database restored. Restarting…', 'success');
    } else if (result.message !== 'Restore cancelled') {
      toast.show(result.message ?? 'Restore failed', 'error');
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={handleSave} className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Pharmacy / Business Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Pharmacy Name</label>
            <input className="input" value={form.pharmacy_name} onChange={(e) => setForm((f) => ({ ...f, pharmacy_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.pharmacy_phone} onChange={(e) => setForm((f) => ({ ...f, pharmacy_phone: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Address</label>
            <input className="input" value={form.pharmacy_address} onChange={(e) => setForm((f) => ({ ...f, pharmacy_address: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.pharmacy_email} onChange={(e) => setForm((f) => ({ ...f, pharmacy_email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Logo</label>
            <div className="flex items-center gap-2">
              <input className="input" readOnly value={form.pharmacy_logo_path} placeholder="No logo selected" />
              <button type="button" className="btn-secondary shrink-0" onClick={handlePickLogo}>
                Browse…
              </button>
            </div>
          </div>
        </div>

        <h2 className="pt-2 text-sm font-semibold text-slate-700">Billing & Alerts</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Currency Symbol</label>
            <input className="input" value={form.currency_symbol} onChange={(e) => setForm((f) => ({ ...f, currency_symbol: e.target.value }))} />
          </div>
          <div>
            <label className="label">Invoice Prefix</label>
            <input className="input" value={form.invoice_prefix} onChange={(e) => setForm((f) => ({ ...f, invoice_prefix: e.target.value }))} />
          </div>
          <div>
            <label className="label">Default Low-Stock Threshold</label>
            <input
              type="number"
              min={0}
              className="input"
              value={form.low_stock_default_threshold}
              onChange={(e) => setForm((f) => ({ ...f, low_stock_default_threshold: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Near-Expiry Alert Window (days)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={form.near_expiry_days}
              onChange={(e) => setForm((f) => ({ ...f, near_expiry_days: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Receipt Footer Note</label>
            <input
              className="input"
              value={form.receipt_footer_note}
              onChange={(e) => setForm((f) => ({ ...f, receipt_footer_note: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      <div className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-slate-700">Backup & Restore</h2>
        <p className="text-xs text-slate-400">
          Database file: <span className="font-mono">{dbPath}</span>
        </p>
        <p className="text-sm text-slate-600">
          Since this app works fully offline, your data lives only on this computer. Back it up regularly to a USB
          drive or cloud folder to protect against data loss.
        </p>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={handleBackup}>
            Export Backup (.db)
          </button>
          <button className="btn-secondary" onClick={() => setRestoreConfirm(true)}>
            Restore from Backup
          </button>
        </div>
      </div>

      {restoreConfirm && (
        <ConfirmDialog
          title="Restore Database"
          message="This will replace all current data with the selected backup file and restart the app. This cannot be undone. Continue?"
          confirmLabel="Restore"
          danger
          onConfirm={handleRestore}
          onCancel={() => setRestoreConfirm(false)}
        />
      )}
    </div>
  );
}
