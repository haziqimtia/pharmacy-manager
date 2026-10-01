-- Pharmacy Manager SQLite schema
-- Designed so multi-user/roles can be layered on later (users table already has a role column).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin', -- admin | pharmacist | cashier (future use)
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS suppliers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  contact_person TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  notes         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medicines (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  generic_name    TEXT,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  manufacturer    TEXT,
  unit            TEXT NOT NULL DEFAULT 'tablet', -- tablet | strip | bottle | box | other
  reorder_level   REAL NOT NULL DEFAULT 10,
  default_sale_price REAL NOT NULL DEFAULT 0,     -- default/last known MRP, convenience for POS search display
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic ON medicines(generic_name);

-- Batch-wise stock. Every unit of stock belongs to a batch so expiry + cost stay accurate.
CREATE TABLE IF NOT EXISTS batches (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id       INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  batch_number      TEXT NOT NULL,
  expiry_date       TEXT NOT NULL,  -- ISO date YYYY-MM-DD
  purchase_price    REAL NOT NULL CHECK (purchase_price >= 0),
  sale_price        REAL NOT NULL CHECK (sale_price >= 0),
  quantity          REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0), -- current remaining qty in this batch
  purchase_item_id  INTEGER REFERENCES purchase_items(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);

CREATE TABLE IF NOT EXISTS purchases (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number  TEXT,
  purchase_date   TEXT NOT NULL DEFAULT (date('now')),
  total_amount    REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id     INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  medicine_id     INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_id        INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  batch_number    TEXT NOT NULL,
  expiry_date     TEXT NOT NULL,
  quantity        REAL NOT NULL CHECK (quantity > 0),
  purchase_price  REAL NOT NULL CHECK (purchase_price >= 0),
  sale_price      REAL NOT NULL CHECK (sale_price >= 0),
  line_total      REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_medicine ON purchase_items(medicine_id);

CREATE TABLE IF NOT EXISTS sales (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number      TEXT NOT NULL UNIQUE,
  sale_date           TEXT NOT NULL DEFAULT (datetime('now')),
  customer_name       TEXT,
  customer_phone      TEXT,
  subtotal            REAL NOT NULL DEFAULT 0,
  discount_type       TEXT NOT NULL DEFAULT 'none', -- none | fixed | percent
  discount_value      REAL NOT NULL DEFAULT 0,
  discount_amount     REAL NOT NULL DEFAULT 0,
  total_amount        REAL NOT NULL DEFAULT 0,
  total_cost          REAL NOT NULL DEFAULT 0,
  profit_amount       REAL NOT NULL DEFAULT 0,
  payment_method      TEXT NOT NULL DEFAULT 'cash', -- cash | card | upi | other
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);

CREATE TABLE IF NOT EXISTS sale_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id           INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medicine_id       INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_id          INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  batch_number      TEXT,
  quantity          REAL NOT NULL CHECK (quantity > 0),
  unit_sale_price   REAL NOT NULL CHECK (unit_sale_price >= 0),
  unit_cost_price   REAL NOT NULL DEFAULT 0,
  discount_type     TEXT NOT NULL DEFAULT 'none', -- none | fixed | percent
  discount_value    REAL NOT NULL DEFAULT 0,
  discount_amount   REAL NOT NULL DEFAULT 0,
  line_total        REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_medicine ON sale_items(medicine_id);

-- Full ledger: every stock change, of any kind, is recorded here.
CREATE TABLE IF NOT EXISTS stock_movements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id     INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  batch_id        INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  movement_type   TEXT NOT NULL, -- purchase | sale | return_in | return_out | damage | expiry_writeoff | adjustment
  quantity_change REAL NOT NULL, -- positive = stock added, negative = stock removed
  reference_type  TEXT,          -- purchase | sale | manual
  reference_id    INTEGER,
  reason          TEXT,
  movement_date   TEXT NOT NULL DEFAULT (datetime('now')),
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine ON stock_movements(medicine_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
