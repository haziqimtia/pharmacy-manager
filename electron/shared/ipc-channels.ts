export const IPC = {
  AUTH_LOGIN: 'auth:login',

  CATEGORIES_LIST: 'categories:list',
  CATEGORIES_CREATE: 'categories:create',

  MEDICINES_LIST: 'medicines:list',
  MEDICINES_GET: 'medicines:get',
  MEDICINES_CREATE: 'medicines:create',
  MEDICINES_UPDATE: 'medicines:update',
  MEDICINES_DELETE: 'medicines:delete',
  MEDICINES_BATCHES: 'medicines:batches',

  SUPPLIERS_LIST: 'suppliers:list',
  SUPPLIERS_CREATE: 'suppliers:create',
  SUPPLIERS_UPDATE: 'suppliers:update',
  SUPPLIERS_DELETE: 'suppliers:delete',

  PURCHASES_LIST: 'purchases:list',
  PURCHASES_GET: 'purchases:get',
  PURCHASES_CREATE: 'purchases:create',

  SALES_LIST: 'sales:list',
  SALES_GET: 'sales:get',
  SALES_CREATE: 'sales:create',
  SALES_SEARCH_MEDICINES: 'sales:searchMedicines',
  SALES_NEXT_INVOICE: 'sales:nextInvoice',
  SALES_PRINT_RECEIPT: 'sales:printReceipt',

  STOCK_MOVEMENTS_LIST: 'stock:movementsList',
  STOCK_ADJUST: 'stock:adjust',
  STOCK_LOW: 'stock:lowStock',
  STOCK_NEAR_EXPIRY: 'stock:nearExpiry',

  DASHBOARD_STATS: 'dashboard:stats',

  REPORTS_MONTHLY: 'reports:monthly',
  REPORTS_BEST_SELLING: 'reports:bestSelling',
  REPORTS_SLOW_MOVING: 'reports:slowMoving',
  REPORTS_EXPORT_CSV: 'reports:exportCsv',
  REPORTS_EXPORT_PDF: 'reports:exportPdf',

  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_PICK_LOGO: 'settings:pickLogo',

  BACKUP_EXPORT: 'backup:export',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_GET_PATH: 'backup:getPath',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
