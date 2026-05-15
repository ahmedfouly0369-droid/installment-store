import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC, type IpcResult } from '@shared/ipc-channels'
import * as auth from '../services/auth'
import * as categories from '../services/categories'
import * as products from '../services/products'
import * as inventory from '../services/inventory'
import * as suppliers from '../services/suppliers'
import * as customers from '../services/customers'
import * as sales from '../services/sales'
import * as reports from '../services/reports'
import * as treasury from '../services/treasury'
import * as expenses from '../services/expenses'
import * as backup from '../services/backup'
import * as settings from '../services/settings'

type Handler = (...args: unknown[]) => unknown

async function pickFolder(defaultPath?: string): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

async function pickBackupFile(defaultPath?: string): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    defaultPath,
    filters: [
      { name: 'Database', extensions: ['db'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

function wrap<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

async function wrapAsync<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

function on<T>(channel: string, fn: (...args: unknown[]) => T): void {
  ipcMain.handle(channel, async (_event, ...args) => wrap(() => fn(...args)))
}

function onAsync<T>(channel: string, fn: (...args: unknown[]) => Promise<T>): void {
  ipcMain.handle(channel, async (_event, ...args) => wrapAsync(() => fn(...args)))
}

export function registerIpc(): void {
  on(IPC.AUTH.LOGIN, (...args) => {
    const [username, password] = args as [string, string]
    return auth.login(username, password)
  })
  on(IPC.AUTH.LOGOUT, (...args) => {
    const [token] = args as [string]
    auth.logout(token)
    return true
  })
  on(IPC.AUTH.CHANGE_PASSWORD, (...args) => {
    const [token, current, next] = args as [string, string, string]
    auth.changePassword(token, current, next)
    return true
  })

  on(IPC.USERS.LIST, (...args) => auth.listUsers((args as [string])[0]))
  on(IPC.USERS.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof auth.createUser>[1]]
    return auth.createUser(token, data)
  })
  on(IPC.USERS.UPDATE, (...args) => {
    const [token, id, data] = args as [string, number, Parameters<typeof auth.updateUser>[2]]
    return auth.updateUser(token, id, data)
  })
  on(IPC.USERS.DELETE, (...args) => {
    const [token, id] = args as [string, number]
    auth.deleteUser(token, id)
    return true
  })
  on(IPC.USERS.RESET_PASSWORD, (...args) => {
    const [token, id, password] = args as [string, number, string]
    auth.resetPassword(token, id, password)
    return true
  })

  on(IPC.CATEGORIES.LIST, (...args) => categories.listCategories((args as [string])[0]))
  on(IPC.CATEGORIES.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof categories.createCategory>[1]]
    return categories.createCategory(token, data)
  })
  on(IPC.CATEGORIES.UPDATE, (...args) => {
    const [token, id, data] = args as [
      string,
      number,
      Parameters<typeof categories.updateCategory>[2]
    ]
    return categories.updateCategory(token, id, data)
  })
  on(IPC.CATEGORIES.DELETE, (...args) => {
    const [token, id] = args as [string, number]
    categories.deleteCategory(token, id)
    return true
  })

  on(IPC.BRANDS.LIST, (...args) => {
    const [token, categoryId] = args as [string, number | undefined]
    return categories.listBrands(token, categoryId)
  })
  on(IPC.BRANDS.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof categories.createBrand>[1]]
    return categories.createBrand(token, data)
  })
  on(IPC.BRANDS.UPDATE, (...args) => {
    const [token, id, data] = args as [string, number, Parameters<typeof categories.updateBrand>[2]]
    return categories.updateBrand(token, id, data)
  })
  on(IPC.BRANDS.DELETE, (...args) => {
    const [token, id] = args as [string, number]
    categories.deleteBrand(token, id)
    return true
  })

  on(IPC.PRODUCTS.LIST, (...args) => {
    const [token, filters] = args as [string, Parameters<typeof products.listProducts>[1]]
    return products.listProducts(token, filters)
  })
  on(IPC.PRODUCTS.GET, (...args) => {
    const [token, id] = args as [string, number]
    return products.getProduct(token, id)
  })
  on(IPC.PRODUCTS.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof products.createProduct>[1]]
    return products.createProduct(token, data)
  })
  on(IPC.PRODUCTS.UPDATE, (...args) => {
    const [token, id, data] = args as [string, number, Parameters<typeof products.updateProduct>[2]]
    return products.updateProduct(token, id, data)
  })
  on(IPC.PRODUCTS.DELETE, (...args) => {
    const [token, id] = args as [string, number]
    products.deleteProduct(token, id)
    return true
  })

  on(IPC.WAREHOUSES.LIST, (...args) => inventory.listWarehouses((args as [string])[0]))
  on(IPC.WAREHOUSES.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof inventory.createWarehouse>[1]]
    return inventory.createWarehouse(token, data)
  })
  on(IPC.WAREHOUSES.UPDATE, (...args) => {
    const [token, id, data] = args as [
      string,
      number,
      Parameters<typeof inventory.updateWarehouse>[2]
    ]
    return inventory.updateWarehouse(token, id, data)
  })
  on(IPC.WAREHOUSES.DELETE, (...args) => {
    const [token, id] = args as [string, number]
    inventory.deleteWarehouse(token, id)
    return true
  })
  on(IPC.WAREHOUSES.INVENTORY, (...args) => {
    const [token, filters] = args as [string, Parameters<typeof inventory.listInventory>[1]]
    return inventory.listInventory(token, filters)
  })
  on(IPC.WAREHOUSES.ADJUST, (...args) => {
    const [token, data] = args as [string, Parameters<typeof inventory.manualAdjust>[1]]
    inventory.manualAdjust(token, data)
    return true
  })
  on(IPC.WAREHOUSES.RETURN, (...args) => {
    const [token, data] = args as [string, Parameters<typeof inventory.recordReturn>[1]]
    inventory.recordReturn(token, data)
    return true
  })

  on(IPC.SUPPLIERS.LIST, (...args) => suppliers.listSuppliers((args as [string])[0]))
  on(IPC.SUPPLIERS.GET, (...args) => {
    const [token, id] = args as [string, number]
    return suppliers.getSupplier(token, id)
  })
  on(IPC.SUPPLIERS.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof suppliers.createSupplier>[1]]
    return suppliers.createSupplier(token, data)
  })
  on(IPC.SUPPLIERS.UPDATE, (...args) => {
    const [token, id, data] = args as [
      string,
      number,
      Parameters<typeof suppliers.updateSupplier>[2]
    ]
    return suppliers.updateSupplier(token, id, data)
  })
  on(IPC.SUPPLIERS.DELETE, (...args) => {
    const [token, id] = args as [string, number]
    suppliers.deleteSupplier(token, id)
    return true
  })
  on(IPC.SUPPLIERS.PURCHASES, (...args) => {
    const [token, supplierId] = args as [string, number | undefined]
    return suppliers.listPurchases(token, supplierId)
  })
  on(IPC.SUPPLIERS.PAYMENTS, (...args) => {
    const [token, supplierId] = args as [string, number]
    return suppliers.listSupplierPayments(token, supplierId)
  })
  on(IPC.SUPPLIERS.PAY, (...args) => {
    const [token, data] = args as [string, Parameters<typeof suppliers.paySupplier>[1]]
    return suppliers.paySupplier(token, data)
  })
  on(IPC.SUPPLIERS.PURCHASE_CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof suppliers.createPurchase>[1]]
    return suppliers.createPurchase(token, data)
  })

  on(IPC.CUSTOMERS.LIST, (...args) => {
    const [token, search] = args as [string, string | undefined]
    return customers.listCustomers(token, search)
  })
  on(IPC.CUSTOMERS.GET, (...args) => {
    const [token, id] = args as [string, number]
    return customers.getCustomer(token, id)
  })
  on(IPC.CUSTOMERS.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof customers.createCustomer>[1]]
    return customers.createCustomer(token, data)
  })
  on(IPC.CUSTOMERS.UPDATE, (...args) => {
    const [token, id, data] = args as [
      string,
      number,
      Parameters<typeof customers.updateCustomer>[2]
    ]
    return customers.updateCustomer(token, id, data)
  })
  on(IPC.CUSTOMERS.DELETE, (...args) => {
    const [token, id] = args as [string, number]
    customers.deleteCustomer(token, id)
    return true
  })
  on(IPC.CUSTOMERS.SALES, (...args) => {
    const [token, id] = args as [string, number]
    return customers.listCustomerSales(token, id)
  })
  on(IPC.CUSTOMERS.INSTALLMENTS, (...args) => {
    const [token, id] = args as [string, number]
    return customers.listCustomerInstallments(token, id)
  })
  on(IPC.CUSTOMERS.PAYMENTS, (...args) => {
    const [token, id] = args as [string, number]
    return customers.listCustomerPayments(token, id)
  })
  on(IPC.CUSTOMERS.SET_BLACKLIST, (...args) => {
    const [token, id, blacklisted] = args as [string, number, boolean]
    customers.setBlacklist(token, id, blacklisted)
    return true
  })

  on(IPC.SALES.LIST, (...args) => {
    const [token, filters] = args as [string, Parameters<typeof sales.listSales>[1]]
    return sales.listSales(token, filters)
  })
  on(IPC.SALES.GET, (...args) => {
    const [token, id] = args as [string, number]
    const sale = sales.getSale(token, id)
    if (!sale) return null
    const items = sales.getSaleItems(token, id)
    const installments = sales.listInstallmentsForSale(token, id)
    const payments = sales.listPaymentsForSale(token, id)
    return { sale, items, installments, payments }
  })
  on(IPC.SALES.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof sales.createSale>[1]]
    return sales.createSale(token, data)
  })
  on(IPC.SALES.CANCEL, (...args) => {
    const [token, id] = args as [string, number]
    sales.cancelSale(token, id)
    return true
  })
  on(IPC.SALES.PAY_INSTALLMENT, (...args) => {
    const [token, data] = args as [string, Parameters<typeof sales.payInstallment>[1]]
    return sales.payInstallment(token, data)
  })
  on(IPC.SALES.WAIVE_INSTALLMENT, (...args) => {
    const [token, data] = args as [string, Parameters<typeof sales.waiveInstallment>[1]]
    return sales.waiveInstallment(token, data)
  })
  on(IPC.SALES.INSTALLMENTS, (...args) => {
    const [token, saleId] = args as [string, number]
    return sales.listInstallmentsForSale(token, saleId)
  })

  on(IPC.REPORTS.DASHBOARD, (...args) => reports.getDashboardSummary((args as [string])[0]))
  on(IPC.REPORTS.SALES_TREND, (...args) => {
    const [token, months] = args as [string, number | undefined]
    return reports.getSalesTrend(token, months)
  })
  on(IPC.REPORTS.OVERDUE_ALERTS, (...args) => reports.getOverdueAlerts((args as [string])[0]))
  on(IPC.REPORTS.UPCOMING_DUE, (...args) => {
    const [token, days] = args as [string, number | undefined]
    return reports.getUpcomingDue(token, days)
  })
  on(IPC.REPORTS.PROFIT_LOSS, (...args) => {
    const [token, days] = args as [string, number | undefined]
    return reports.getProfitLoss(token, days)
  })
  on(IPC.REPORTS.SUPPLIER_BALANCES, (...args) => reports.getSupplierBalances((args as [string])[0]))
  on(IPC.REPORTS.INSTALLMENTS_BY_RANGE, (...args) => {
    const [token, filters] = args as [string, { from: string; to: string }]
    return reports.getInstallmentsByRange(token, filters)
  })
  on(IPC.REPORTS.OVERDUE_INSTALLMENTS, (...args) =>
    reports.getOverdueInstallments((args as [string])[0])
  )
  on(IPC.REPORTS.BAD_DEBT_INSTALLMENTS, (...args) =>
    reports.getBadDebtInstallments((args as [string])[0])
  )
  on(IPC.REPORTS.NOTIFICATION_SUMMARY, (...args) =>
    reports.getNotificationSummary((args as [string])[0])
  )

  on(IPC.SETTINGS.GET, (...args) => settings.getAppSettings((args as [string])[0]))
  on(IPC.SETTINGS.UPDATE, (...args) => {
    const [token, input] = args as [string, Parameters<typeof settings.updateAppSettings>[1]]
    return settings.updateAppSettings(token, input)
  })

  on(IPC.TREASURY.LIST, (...args) => {
    const [token, filters] = args as [string, Parameters<typeof treasury.listTreasuryEntries>[1]]
    return treasury.listTreasuryEntries(token, filters)
  })
  on(IPC.TREASURY.ADD, (...args) => {
    const [token, data] = args as [string, Parameters<typeof treasury.addTreasuryEntry>[1]]
    return treasury.addTreasuryEntry(token, data)
  })
  on(IPC.TREASURY.BALANCE, (...args) => treasury.getTreasuryBalance((args as [string])[0]))

  on(IPC.EXPENSES.LIST, (...args) => {
    const [token, filters] = args as [string, Parameters<typeof expenses.listExpenses>[1]]
    return expenses.listExpenses(token, filters)
  })
  on(IPC.EXPENSES.CREATE, (...args) => {
    const [token, data] = args as [string, Parameters<typeof expenses.createExpense>[1]]
    return expenses.createExpense(token, data)
  })
  on(IPC.EXPENSES.UPDATE, (...args) => {
    const [token, id, data] = args as [string, number, Parameters<typeof expenses.updateExpense>[2]]
    return expenses.updateExpense(token, id, data)
  })
  on(IPC.EXPENSES.DELETE, (...args) => {
    const [token, id] = args as [string, number]
    expenses.deleteExpense(token, id)
    return true
  })
  on(IPC.EXPENSES.SUMMARY, (...args) => {
    const [token, filters] = args as [string, Parameters<typeof expenses.getExpensesSummary>[1]]
    return expenses.getExpensesSummary(token, filters)
  })

  on(IPC.BACKUP.SETTINGS_GET, (...args) => backup.getBackupSettings((args as [string])[0]))
  on(IPC.BACKUP.SETTINGS_UPDATE, (...args) => {
    const [token, input] = args as [string, Parameters<typeof backup.updateBackupSettings>[1]]
    return backup.updateBackupSettings(token, input)
  })
  on(IPC.BACKUP.RUN, (...args) => backup.runManualBackup((args as [string])[0]))
  on(IPC.BACKUP.LIST_LOGS, (...args) => {
    const [token, limit] = args as [string, number | undefined]
    return backup.listBackupLogs(token, limit)
  })
  on(IPC.BACKUP.RESTORE, (...args) => {
    const [token, sourcePath] = args as [string, string]
    return backup.restoreBackup(token, sourcePath)
  })
  onAsync(IPC.BACKUP.PICK_FOLDER, async (...args) => {
    const [, defaultPath] = args as [string, string | undefined]
    return pickFolder(defaultPath)
  })
  onAsync(IPC.BACKUP.PICK_FILE, async (...args) => {
    const [, defaultPath] = args as [string, string | undefined]
    return pickBackupFile(defaultPath)
  })
  onAsync(IPC.BACKUP.OPEN_FOLDER, async (...args) => {
    const [, folderPath] = args as [string, string]
    if (folderPath) await shell.openPath(folderPath)
    return true
  })
}

// suppress unused
void ({} as Handler)
