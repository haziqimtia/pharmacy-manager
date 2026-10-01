import { ipcMain, dialog, app } from 'electron';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { getDatabase, closeDatabase, getDbFilePath } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { BackupResult } from '../shared/types';

export function registerBackupHandlers() {
  ipcMain.handle(IPC.BACKUP_GET_PATH, () => getDbFilePath());

  ipcMain.handle(IPC.BACKUP_EXPORT, async (): Promise<BackupResult> => {
    const db = getDatabase();
    const defaultName = `pharmacy-backup-${new Date().toISOString().slice(0, 10)}.db`;
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Backup database',
      defaultPath: defaultName,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (canceled || !filePath) return { success: false, message: 'Backup cancelled' };

    try {
      await db.backup(filePath);
      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Backup failed' };
    }
  });

  ipcMain.handle(IPC.BACKUP_RESTORE, async (): Promise<BackupResult> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Restore database from backup',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (canceled || filePaths.length === 0) return { success: false, message: 'Restore cancelled' };
    const sourcePath = filePaths[0];

    try {
      const probe = new Database(sourcePath, { readonly: true, fileMustExist: true });
      const hasSalesTable = probe
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sales'")
        .get();
      probe.close();
      if (!hasSalesTable) {
        return { success: false, message: 'Selected file does not look like a valid Pharmacy Manager backup' };
      }

      const targetPath = getDbFilePath();
      closeDatabase();

      fs.copyFileSync(sourcePath, targetPath);
      for (const ext of ['-wal', '-shm']) {
        const stale = targetPath + ext;
        if (fs.existsSync(stale)) fs.unlinkSync(stale);
      }

      // Restart so every module re-opens a fresh connection to the restored file.
      app.relaunch();
      app.exit(0);
      return { success: true, path: targetPath };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Restore failed' };
    }
  });
}
