import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderHiddenWindow(html: string): Promise<BrowserWindow> {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

/** Opens the OS print dialog for the given HTML document (used for receipts). */
export async function printHtml(html: string): Promise<{ success: boolean; message?: string }> {
  const win = await renderHiddenWindow(html);
  return new Promise((resolve) => {
    win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
      win.close();
      if (success) resolve({ success: true });
      else resolve({ success: false, message: failureReason || 'Print was cancelled' });
    });
  });
}

/** Renders HTML to a PDF file chosen by the user via a save dialog. */
export async function exportHtmlToPdf(
  html: string,
  defaultFileName: string
): Promise<{ success: boolean; path?: string; message?: string }> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: defaultFileName,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false, message: 'Export cancelled' };

  const win = await renderHiddenWindow(html);
  try {
    const buffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } finally {
    win.close();
  }
}
