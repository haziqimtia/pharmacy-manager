import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { IPC } from '../shared/ipc-channels';
import { verifyPassword } from '../auth/password';
import type { LoginResult } from '../shared/types';

export function registerAuthHandlers() {
  const db = getDatabase();

  ipcMain.handle(IPC.AUTH_LOGIN, (_event, username: string, password: string): LoginResult => {
    const user = db
      .prepare('SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = ?')
      .get((username ?? '').trim()) as
      | { id: number; username: string; password_hash: string; full_name: string; role: string; is_active: number }
      | undefined;

    if (!user || !user.is_active) {
      return { success: false, message: 'Invalid username or password' };
    }
    if (!verifyPassword(password ?? '', user.password_hash)) {
      return { success: false, message: 'Invalid username or password' };
    }
    return {
      success: true,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    };
  });
}
