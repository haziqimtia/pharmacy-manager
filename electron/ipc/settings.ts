import { ipcMain, dialog } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { Settings } from '../shared/types';

const SETTINGS_KEYS: (keyof Settings)[] = [
  'pharmacy_name',
  'pharmacy_address',
  'pharmacy_phone',
  'pharmacy_email',
  'pharmacy_logo_path',
  'currency_symbol',
  'low_stock_default_threshold',
  'near_expiry_days',
  'receipt_footer_note',
  'invoice_prefix',
];

export function registerSettingsHandlers() {
  const db = getDatabase();

  function readSettings(): Settings {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const result = {} as Settings;
    for (const key of SETTINGS_KEYS) {
      result[key] = map[key] ?? '';
    }
    return result;
  }

  ipcMain.handle(IPC.SETTINGS_GET, (): Settings => readSettings());

  ipcMain.handle(IPC.SETTINGS_UPDATE, (_event, values: Partial<Settings>): Settings => {
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    const tx = db.transaction((entries: [string, string][]) => {
      for (const [k, v] of entries) upsert.run(k, v);
    });
    const entries = Object.entries(values).filter(([k]) => SETTINGS_KEYS.includes(k as keyof Settings)) as [
      string,
      string
    ][];
    tx(entries);
    return readSettings();
  });

  ipcMain.handle(IPC.SETTINGS_PICK_LOGO, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select pharmacy logo',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] }],
    });
    if (canceled || filePaths.length === 0) return { success: false };
    return { success: true, path: filePaths[0] };
  });
}
