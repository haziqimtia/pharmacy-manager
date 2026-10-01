import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './shared/ipc-channels';
import type { PharmacyApi } from './shared/api-types';

const api: PharmacyApi = {
  auth: {
    login: (username, password) => ipcRenderer.invoke(IPC.AUTH_LOGIN, username, password),
  },
  categories: {
    list: () => ipcRenderer.invoke(IPC.CATEGORIES_LIST),
    create: (name) => ipcRenderer.invoke(IPC.CATEGORIES_CREATE, name),
  },
  medicines: {
    list: (filter) => ipcRenderer.invoke(IPC.MEDICINES_LIST, filter),
    get: (id) => ipcRenderer.invoke(IPC.MEDICINES_GET, id),
    create: (input) => ipcRenderer.invoke(IPC.MEDICINES_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IPC.MEDICINES_UPDATE, id, input),
    remove: (id) => ipcRenderer.invoke(IPC.MEDICINES_DELETE, id),
    batches: (medicineId) => ipcRenderer.invoke(IPC.MEDICINES_BATCHES, medicineId),
  },
  suppliers: {
    list: () => ipcRenderer.invoke(IPC.SUPPLIERS_LIST),
    create: (input) => ipcRenderer.invoke(IPC.SUPPLIERS_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IPC.SUPPLIERS_UPDATE, id, input),
    remove: (id) => ipcRenderer.invoke(IPC.SUPPLIERS_DELETE, id),
  },
  purchases: {
    list: (filter) => ipcRenderer.invoke(IPC.PURCHASES_LIST, filter),
    get: (id) => ipcRenderer.invoke(IPC.PURCHASES_GET, id),
    create: (input) => ipcRenderer.invoke(IPC.PURCHASES_CREATE, input),
  },
  sales: {
    list: (filter) => ipcRenderer.invoke(IPC.SALES_LIST, filter),
    get: (id) => ipcRenderer.invoke(IPC.SALES_GET, id),
    create: (input) => ipcRenderer.invoke(IPC.SALES_CREATE, input),
    searchMedicines: (query) => ipcRenderer.invoke(IPC.SALES_SEARCH_MEDICINES, query),
    nextInvoiceNumber: () => ipcRenderer.invoke(IPC.SALES_NEXT_INVOICE),
    printReceipt: (saleId) => ipcRenderer.invoke(IPC.SALES_PRINT_RECEIPT, saleId),
  },
  stock: {
    movements: (filter) => ipcRenderer.invoke(IPC.STOCK_MOVEMENTS_LIST, filter),
    adjust: (input) => ipcRenderer.invoke(IPC.STOCK_ADJUST, input),
    lowStock: () => ipcRenderer.invoke(IPC.STOCK_LOW),
    nearExpiry: (days) => ipcRenderer.invoke(IPC.STOCK_NEAR_EXPIRY, days),
  },
  dashboard: {
    stats: () => ipcRenderer.invoke(IPC.DASHBOARD_STATS),
  },
  reports: {
    monthly: (filter) => ipcRenderer.invoke(IPC.REPORTS_MONTHLY, filter),
    bestSelling: (filter) => ipcRenderer.invoke(IPC.REPORTS_BEST_SELLING, filter),
    slowMoving: (filter) => ipcRenderer.invoke(IPC.REPORTS_SLOW_MOVING, filter),
    exportCsv: (reportType, filter) => ipcRenderer.invoke(IPC.REPORTS_EXPORT_CSV, reportType, filter),
    exportPdf: (reportType, filter) => ipcRenderer.invoke(IPC.REPORTS_EXPORT_PDF, reportType, filter),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
    update: (values) => ipcRenderer.invoke(IPC.SETTINGS_UPDATE, values),
    pickLogo: () => ipcRenderer.invoke(IPC.SETTINGS_PICK_LOGO),
  },
  backup: {
    export: () => ipcRenderer.invoke(IPC.BACKUP_EXPORT),
    restore: () => ipcRenderer.invoke(IPC.BACKUP_RESTORE),
    getPath: () => ipcRenderer.invoke(IPC.BACKUP_GET_PATH),
  },
};

contextBridge.exposeInMainWorld('api', api);
