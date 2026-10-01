import type {
  BackupResult,
  BestSellingRow,
  Category,
  DashboardStats,
  LoginResult,
  LowStockItem,
  ManualStockAdjustmentInput,
  Medicine,
  MedicineInput,
  NearExpiryItem,
  Purchase,
  PurchaseInput,
  ReportFilter,
  Sale,
  SaleInput,
  Settings,
  SlowMovingRow,
  StockMovement,
  Supplier,
  SupplierInput,
  Batch,
  MonthlyReportRow,
} from './types';

export interface ListFilter {
  search?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface PharmacyApi {
  auth: {
    login(username: string, password: string): Promise<LoginResult>;
  };
  categories: {
    list(): Promise<Category[]>;
    create(name: string): Promise<Category>;
  };
  medicines: {
    list(filter?: ListFilter): Promise<Medicine[]>;
    get(id: number): Promise<Medicine | null>;
    create(input: MedicineInput): Promise<Medicine>;
    update(id: number, input: MedicineInput): Promise<Medicine>;
    remove(id: number): Promise<{ success: boolean; message?: string }>;
    batches(medicineId: number): Promise<Batch[]>;
  };
  suppliers: {
    list(): Promise<Supplier[]>;
    create(input: SupplierInput): Promise<Supplier>;
    update(id: number, input: SupplierInput): Promise<Supplier>;
    remove(id: number): Promise<{ success: boolean; message?: string }>;
  };
  purchases: {
    list(filter?: ListFilter): Promise<Purchase[]>;
    get(id: number): Promise<Purchase | null>;
    create(input: PurchaseInput): Promise<Purchase>;
  };
  sales: {
    list(filter?: ListFilter): Promise<Sale[]>;
    get(id: number): Promise<Sale | null>;
    create(input: SaleInput): Promise<Sale>;
    searchMedicines(query: string): Promise<(Medicine & { batches: Batch[] })[]>;
    nextInvoiceNumber(): Promise<string>;
    printReceipt(saleId: number): Promise<{ success: boolean; message?: string }>;
  };
  stock: {
    movements(filter?: ListFilter & { medicine_id?: number }): Promise<StockMovement[]>;
    adjust(input: ManualStockAdjustmentInput): Promise<{ success: boolean; message?: string }>;
    lowStock(): Promise<LowStockItem[]>;
    nearExpiry(days?: number): Promise<NearExpiryItem[]>;
  };
  dashboard: {
    stats(): Promise<DashboardStats>;
  };
  reports: {
    monthly(filter: ReportFilter): Promise<MonthlyReportRow[]>;
    bestSelling(filter: ReportFilter): Promise<BestSellingRow[]>;
    slowMoving(filter: ReportFilter): Promise<SlowMovingRow[]>;
    exportCsv(reportType: string, filter: ReportFilter): Promise<{ success: boolean; path?: string; message?: string }>;
    exportPdf(reportType: string, filter: ReportFilter): Promise<{ success: boolean; path?: string; message?: string }>;
  };
  settings: {
    get(): Promise<Settings>;
    update(values: Partial<Settings>): Promise<Settings>;
    pickLogo(): Promise<{ success: boolean; path?: string }>;
  };
  backup: {
    export(): Promise<BackupResult>;
    restore(): Promise<BackupResult>;
    getPath(): Promise<string>;
  };
}
