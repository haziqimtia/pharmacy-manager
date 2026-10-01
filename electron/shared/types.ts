// Shared types between the Electron main process and the React renderer.
// Keep this file free of any Node/Electron-only imports so it can be used on both sides.

export type Unit = 'tablet' | 'strip' | 'bottle' | 'box' | 'other';

export interface Category {
  id: number;
  name: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

export type SupplierInput = Omit<Supplier, 'id' | 'created_at' | 'updated_at'>;

export interface Medicine {
  id: number;
  name: string;
  generic_name: string | null;
  category_id: number | null;
  category_name?: string | null;
  manufacturer: string | null;
  unit: Unit;
  reorder_level: number;
  default_sale_price: number;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
  // Aggregated, computed on read:
  total_stock?: number;
  stock_value_cost?: number;
  stock_value_sale?: number;
  nearest_expiry?: string | null;
}

export type MedicineInput = {
  name: string;
  generic_name: string | null;
  category_id: number | null;
  manufacturer: string | null;
  unit: Unit;
  reorder_level: number;
  default_sale_price: number;
  is_active: 0 | 1;
};

export interface Batch {
  id: number;
  medicine_id: number;
  medicine_name?: string;
  batch_number: string;
  expiry_date: string;
  purchase_price: number;
  sale_price: number;
  quantity: number;
  purchase_item_id: number | null;
  created_at: string;
  updated_at: string;
}

export type DiscountType = 'none' | 'fixed' | 'percent';

export interface Purchase {
  id: number;
  supplier_id: number | null;
  supplier_name?: string | null;
  invoice_number: string | null;
  purchase_date: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  medicine_id: number;
  medicine_name?: string;
  batch_id: number | null;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
  line_total: number;
}

export interface PurchaseItemInput {
  medicine_id: number;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
}

export interface PurchaseInput {
  supplier_id: number | null;
  invoice_number: string | null;
  purchase_date: string;
  notes: string | null;
  items: PurchaseItemInput[];
}

export interface Sale {
  id: number;
  invoice_number: string;
  sale_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  total_amount: number;
  total_cost: number;
  profit_amount: number;
  payment_method: 'cash' | 'card' | 'upi' | 'other';
  notes: string | null;
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  medicine_id: number;
  medicine_name?: string;
  batch_id: number | null;
  batch_number: string | null;
  quantity: number;
  unit_sale_price: number;
  unit_cost_price: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  line_total: number;
}

export interface SaleItemInput {
  medicine_id: number;
  quantity: number;
  unit_sale_price: number;
  discount_type: DiscountType;
  discount_value: number;
}

export interface SaleInput {
  customer_name: string | null;
  customer_phone: string | null;
  discount_type: DiscountType;
  discount_value: number;
  payment_method: 'cash' | 'card' | 'upi' | 'other';
  notes: string | null;
  items: SaleItemInput[];
}

export type MovementType =
  | 'purchase'
  | 'sale'
  | 'return_in'
  | 'return_out'
  | 'damage'
  | 'expiry_writeoff'
  | 'adjustment';

export interface StockMovement {
  id: number;
  medicine_id: number;
  medicine_name?: string;
  batch_id: number | null;
  batch_number?: string | null;
  movement_type: MovementType;
  quantity_change: number;
  reference_type: string | null;
  reference_id: number | null;
  reason: string | null;
  movement_date: string;
  created_by: number | null;
}

export interface ManualStockAdjustmentInput {
  medicine_id: number;
  batch_id: number;
  movement_type: Extract<MovementType, 'damage' | 'expiry_writeoff' | 'return_in' | 'return_out'>;
  quantity: number; // always positive; sign is derived from movement_type (return_in = +, others = -)
  reason: string;
}

export interface DashboardStats {
  today_sales_total: number;
  today_profit: number;
  today_invoice_count: number;
  low_stock_count: number;
  near_expiry_count: number;
  total_medicines_in_stock: number;
  inventory_value_cost: number;
  inventory_value_sale: number;
}

export interface MonthlyReportRow {
  period_label: string;
  purchased_qty: number;
  purchased_cost: number;
  sold_qty: number;
  sold_revenue: number;
  profit: number;
}

export interface ReportFilter {
  start_date: string; // ISO date
  end_date: string; // ISO date
}

export interface BestSellingRow {
  medicine_id: number;
  medicine_name: string;
  qty_sold: number;
  revenue: number;
  profit: number;
}

export interface SlowMovingRow {
  medicine_id: number;
  medicine_name: string;
  total_stock: number;
  last_sold_date: string | null;
  days_since_last_sale: number | null;
}

export interface LowStockItem {
  medicine_id: number;
  medicine_name: string;
  unit: Unit;
  total_stock: number;
  reorder_level: number;
}

export interface NearExpiryItem {
  batch_id: number;
  medicine_id: number;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  days_to_expiry: number;
}

export interface Settings {
  pharmacy_name: string;
  pharmacy_address: string;
  pharmacy_phone: string;
  pharmacy_email: string;
  pharmacy_logo_path: string;
  currency_symbol: string;
  low_stock_default_threshold: string;
  near_expiry_days: string;
  receipt_footer_note: string;
  invoice_prefix: string;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  user?: { id: number; username: string; full_name: string; role: string };
}

export interface BackupResult {
  success: boolean;
  path?: string;
  message?: string;
}
