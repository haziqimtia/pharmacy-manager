# Pharmacy Manager

A complete, offline-first Pharmacy Management System for Windows desktop. Built with Electron, React, TypeScript, and SQLite — all data stays on the local computer, no internet connection required.

## Features

- **Medicines & Inventory** — batch-wise stock tracking, FIFO deduction, profit margin calculator, low-stock and near-expiry alerts
- **Purchases** — supplier management, stock-in with automatic batch creation and ledger logging
- **Sales / POS** — cart-based billing, per-item and invoice-level discounts, FIFO stock deduction, printable receipts
- **Stock Ledger** — a full, append-only history of every stock movement (purchases, sales, adjustments, returns, damage, expiry write-offs)
- **Dashboard & Reports** — today's stats, monthly summaries with custom date ranges, best-selling and slow-moving analysis, CSV/PDF export
- **Settings & Backup** — business/branding info, single-admin login, one-click backup and restore of the entire database

## Tech Stack

- Electron (desktop shell) + React 18 + TypeScript (renderer)
- SQLite via `better-sqlite3` (fully offline, local file database)
- Vite (renderer bundler) + Tailwind CSS (UI)
- electron-builder (Windows NSIS installer)

---

## Running in Development

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

This starts the Vite dev server and launches the Electron window pointed at it, with hot reload for the renderer. The default login is:

- **Username:** `admin`
- **Password:** `admin123`

The SQLite database is created automatically on first run — no manual setup needed.

## Building

```bash
npm run build
```

This runs the renderer build (Vite → `dist/`) and the Electron main-process build (TypeScript → `dist-electron/`).

## Building the Windows Installer

```bash
npm run dist:win
```

This packages the app and produces an NSIS installer (`Pharmacy Manager-Setup-<version>.exe`) in the `release/` folder, with:

- A setup wizard that lets the user choose the install location
- A Start Menu shortcut
- A desktop shortcut
- A proper uninstaller registered in Windows "Apps & Features"

> **Note:** Producing a Windows `.exe` requires building on Windows, or on macOS/Linux via CI (e.g. GitHub Actions `windows-latest` runner) or a working x64 Wine install. Cross-building from Apple Silicon Macs without an x64 Wine toolchain is not supported — the `electron-builder` configuration in `package.json` (`build` field) is Windows-ready and will produce the installer correctly once run in a Windows-capable environment. `postinstall` runs `electron-builder install-app-deps` automatically so the native `better-sqlite3` module is rebuilt for Electron.

To customize the app icon, replace `build/icon.ico` (and optionally `build/icon.png`) with your own artwork before building.

## Installing (for pharmacy staff)

1. Download `Pharmacy Manager-Setup-<version>.exe`.
2. Double-click it and follow the setup wizard (choose an install folder, or use the default).
3. Once installed, launch **Pharmacy Manager** from the Start Menu or the desktop shortcut.
4. Log in with the default admin account:
   - **Username:** `admin`
   - **Password:** `admin123`
5. Go to **Settings** and fill in your pharmacy's name, address, phone, and logo — this appears on printed receipts and reports.

No internet connection is required at any point. All data is stored locally on this computer only.

## Backups

Since the app is fully offline, your data lives only on this computer. From **Settings → Backup & Restore**:

- **Export Backup (.db)** saves a complete copy of the database to a file you choose (USB drive, cloud-synced folder, etc.). Do this regularly.
- **Restore from Backup** replaces all current data with a previously exported `.db` file and restarts the app. This cannot be undone, so double-check before confirming.

## Project Structure

```
electron/          Electron main process, preload script, IPC handlers, SQLite schema
  db/               Database init + schema.sql
  ipc/              One module per domain (medicines, purchases, sales, stock, reports, ...)
  shared/           Types and IPC channel names shared between main and renderer
src/                React renderer (pages, components, lib/contexts)
build/              Installer icon assets (icon.ico / icon.png)
```

## License

Proprietary — for use by the licensed pharmacy only.
