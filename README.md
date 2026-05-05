# Installment Store / تطبيق البيع بالتقسيط

A complete Windows desktop application (Electron + React + TypeScript + SQLite) for managing the installment sales of home electronics. Bilingual UI (Arabic / English) with full RTL support, multi-user role-based access, customer/installment management, supplier purchase tracking, warehouse inventory by condition, financial dashboard, and overdue customer alerts.

تطبيق سطح مكتب متكامل على Windows لإدارة بيع الأجهزة المنزلية بالتقسيط. يدعم اللغتين العربية والإنجليزية، وعدة مستخدمين بصلاحيات مختلفة، ويتضمن إدارة العملاء والأقساط والموردين والمخازن وتحليل مالي شامل وتنبيهات للأقساط المستحقة والمتأخرة.

## Features

- **Categories & Brands** – Manage categories (refrigerator, washing machine, stove, etc.) and brands (Kiriazi, LG, Samsung, Hitachi, Al-Arabi, Toshiba) with predefined defaults.
- **Products** – Track each product with cost, cash, and installment prices.
- **Warehouses & Inventory** – Multiple warehouses; stock by condition (new / used / returned / damaged); record customer returns.
- **Suppliers** – Track purchase invoices, payments, due amounts, and full financial status. Payments allocated FIFO against open invoices.
- **Customers** – Customer profile with national ID, phones, address, workplace, and **multiple guarantors** on the same page.
- **Sales / Installments** – Cash or installment sales; auto-generates installment schedule; supports overflow when a payment exceeds the current installment; cancel sale returns inventory.
- **Customer alerts** – When trying to sell to a customer with overdue balance, app shows the exact overdue amount before continuing. Blacklist support.
- **Bad debt** – Waive an installment to flag it as bad debt; reflected in financial reports.
- **Treasury** – Automated entries for sales / payments / supplier payouts plus manual entries.
- **Financial Dashboard** – Sales value, inventory value, treasury balance, profit, bad debts, outstanding receivables, overdue receivables, due to suppliers, with charts.
- **Notifications** – Currently overdue customers + installments due in the next N days.
- **Multi-user with roles** – `admin` (full access), `accountant` (financial / suppliers / payments), `sales` (customers / sales / payments).
- **Bilingual UI** – Arabic (default, RTL) and English (LTR), switchable at runtime.

## Tech Stack

- **Electron 32** + **electron-vite** – Desktop runtime and build tooling
- **React 18** + **TypeScript 5** – Renderer UI
- **SQLite** via **better-sqlite3** – Local database (stored in the user's `app data` folder)
- **Tailwind CSS 3** – Styling
- **Recharts** – Financial charts
- **i18next** + **react-i18next** – Bilingual support with RTL/LTR
- **Zustand** – Auth state
- **TanStack Query** – Data fetching and caching
- **electron-builder** – Windows installer (NSIS)

## Default Login

```
username: admin
password: admin123
```

After first login, change the password via the **Users** page.

## Development

Requirements: **Node.js 20+**, **npm 10+**, and (for Windows build only) Windows OS or Wine. On Linux/macOS you can build the Linux variant for development testing.

```bash
# Install dependencies (also rebuilds better-sqlite3 native bindings for Electron)
npm install

# Run in dev mode (Electron + React HMR)
npm run dev

# Type-check
npm run typecheck

# Lint
npm run lint

# Build for current platform (output in out/)
npm run build
```

## Building the Windows Installer

```bash
# Run on Windows (recommended) or with Wine on Linux
npm run build:win
```

Output: `release/installment-store-<version>-setup.exe`

The installer uses NSIS, lets the user choose the installation directory, and creates start menu and desktop shortcuts.

## Database

- Path: `<userData>/installment-store.db` (where `<userData>` is `%APPDATA%/Installment Store` on Windows).
- WAL journal mode is enabled for better concurrent reliability.
- Foreign keys are enforced.
- Schema is created automatically on first launch and seeded with default categories, brands, the main warehouse, and the default admin user.

## Project Structure

```
src/
├── main/              # Electron main process (Node.js)
│   ├── db/            # Schema, seed, connection singleton
│   ├── services/      # Business logic (auth, sales, suppliers, etc.)
│   ├── ipc/           # IPC channel handlers
│   └── index.ts       # Electron app entry, window creation
├── preload/           # Context bridge between main and renderer
├── renderer/          # React UI
│   └── src/
│       ├── components/  # Layout, Sidebar, ui primitives
│       ├── pages/       # Route pages (Dashboard, Sales, Customers, ...)
│       ├── locales/     # ar.json, en.json
│       ├── i18n/        # i18next setup with RTL/LTR
│       ├── lib/         # api / utils
│       └── store/       # zustand auth store
└── shared/            # Types and IPC channel constants shared between main and renderer
```

## License

MIT © Ahmed Fouly
