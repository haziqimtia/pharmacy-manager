import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { initDatabase } from './db';
import { registerAuthHandlers } from './ipc/auth';
import { registerCategoryHandlers } from './ipc/categories';
import { registerMedicineHandlers } from './ipc/medicines';
import { registerSupplierHandlers } from './ipc/suppliers';
import { registerPurchaseHandlers } from './ipc/purchases';
import { registerSaleHandlers } from './ipc/sales';
import { registerStockHandlers } from './ipc/stock';
import { registerDashboardHandlers } from './ipc/dashboard';
import { registerReportHandlers } from './ipc/reports';
import { registerSettingsHandlers } from './ipc/settings';
import { registerBackupHandlers } from './ipc/backup';

const isDev = process.argv.includes('--dev');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f8faf9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerAllIpcHandlers() {
  registerAuthHandlers();
  registerCategoryHandlers();
  registerMedicineHandlers();
  registerSupplierHandlers();
  registerPurchaseHandlers();
  registerSaleHandlers();
  registerStockHandlers();
  registerDashboardHandlers();
  registerReportHandlers();
  registerSettingsHandlers();
  registerBackupHandlers();
}

app.whenReady().then(() => {
  initDatabase();
  registerAllIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
