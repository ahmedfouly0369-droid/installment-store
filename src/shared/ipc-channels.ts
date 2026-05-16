export const IPC = {
  AUTH: {
    LOGIN: 'auth:login',
    LOGOUT: 'auth:logout',
    CHANGE_PASSWORD: 'auth:change-password'
  },
  USERS: {
    LIST: 'users:list',
    CREATE: 'users:create',
    UPDATE: 'users:update',
    DELETE: 'users:delete',
    RESET_PASSWORD: 'users:reset-password'
  },
  CATEGORIES: {
    LIST: 'categories:list',
    CREATE: 'categories:create',
    UPDATE: 'categories:update',
    DELETE: 'categories:delete'
  },
  BRANDS: {
    LIST: 'brands:list',
    CREATE: 'brands:create',
    UPDATE: 'brands:update',
    DELETE: 'brands:delete'
  },
  PRODUCTS: {
    LIST: 'products:list',
    CREATE: 'products:create',
    UPDATE: 'products:update',
    DELETE: 'products:delete',
    GET: 'products:get'
  },
  WAREHOUSES: {
    LIST: 'warehouses:list',
    CREATE: 'warehouses:create',
    UPDATE: 'warehouses:update',
    DELETE: 'warehouses:delete',
    INVENTORY: 'warehouses:inventory',
    ADJUST: 'warehouses:adjust',
    RETURN: 'warehouses:return'
  },
  SUPPLIERS: {
    LIST: 'suppliers:list',
    CREATE: 'suppliers:create',
    UPDATE: 'suppliers:update',
    DELETE: 'suppliers:delete',
    GET: 'suppliers:get',
    PURCHASES: 'suppliers:purchases',
    PAYMENTS: 'suppliers:payments',
    PAY: 'suppliers:pay',
    PURCHASE_CREATE: 'suppliers:purchase-create'
  },
  CUSTOMERS: {
    LIST: 'customers:list',
    CREATE: 'customers:create',
    UPDATE: 'customers:update',
    DELETE: 'customers:delete',
    GET: 'customers:get',
    SALES: 'customers:sales',
    INSTALLMENTS: 'customers:installments',
    PAYMENTS: 'customers:payments',
    GUARANTORS: 'customers:guarantors',
    SET_BLACKLIST: 'customers:set-blacklist'
  },
  SALES: {
    LIST: 'sales:list',
    GET: 'sales:get',
    CREATE: 'sales:create',
    CANCEL: 'sales:cancel',
    PAY_INSTALLMENT: 'sales:pay-installment',
    WAIVE_INSTALLMENT: 'sales:waive-installment',
    INSTALLMENTS: 'sales:installments'
  },
  REPORTS: {
    DASHBOARD: 'reports:dashboard',
    SALES_TREND: 'reports:sales-trend',
    OVERDUE_ALERTS: 'reports:overdue-alerts',
    UPCOMING_DUE: 'reports:upcoming-due',
    PROFIT_LOSS: 'reports:profit-loss',
    INVENTORY_VALUE: 'reports:inventory-value',
    SUPPLIER_BALANCES: 'reports:supplier-balances',
    CUSTOMER_BALANCES: 'reports:customer-balances',
    INSTALLMENTS_BY_RANGE: 'reports:installments-by-range',
    OVERDUE_INSTALLMENTS: 'reports:overdue-installments',
    BAD_DEBT_INSTALLMENTS: 'reports:bad-debt-installments',
    NOTIFICATION_SUMMARY: 'reports:notification-summary',
    PRODUCT_STATS: 'reports:product-stats'
  },
  SETTINGS: {
    GET: 'settings:get',
    UPDATE: 'settings:update'
  },
  TREASURY: {
    LIST: 'treasury:list',
    ADD: 'treasury:add',
    BALANCE: 'treasury:balance'
  },
  EXPENSES: {
    LIST: 'expenses:list',
    CREATE: 'expenses:create',
    UPDATE: 'expenses:update',
    DELETE: 'expenses:delete',
    SUMMARY: 'expenses:summary'
  },
  BACKUP: {
    SETTINGS_GET: 'backup:settings:get',
    SETTINGS_UPDATE: 'backup:settings:update',
    RUN: 'backup:run',
    LIST_LOGS: 'backup:list-logs',
    RESTORE: 'backup:restore',
    PICK_FOLDER: 'backup:pick-folder',
    PICK_FILE: 'backup:pick-file',
    OPEN_FOLDER: 'backup:open-folder'
  }
} as const

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }
