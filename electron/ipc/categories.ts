import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import type { Category } from '../shared/types';

export function registerCategoryHandlers() {
  const db = getDatabase();

  ipcMain.handle(IPC.CATEGORIES_LIST, (): Category[] => {
    return db.prepare('SELECT id, name FROM categories ORDER BY name ASC').all() as Category[];
  });

  ipcMain.handle(IPC.CATEGORIES_CREATE, (_event, name: string): Category => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new Error('Category name is required');
    const existing = db.prepare('SELECT id, name FROM categories WHERE name = ?').get(trimmed) as
      | Category
      | undefined;
    if (existing) return existing;
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(trimmed);
    return { id: Number(info.lastInsertRowid), name: trimmed };
  });
}
