import { addDays, format, startOfMonth, subDays, subMonths } from 'date-fns'
import { getDb } from '../db'
import { requireUser } from './auth'
import { refreshOverdueStatuses } from './sales'
import type {
  DashboardSummary,
  Installment,
  OverdueAlert,
  SalesTrendPoint,
  Supplier
} from '@shared/types'

export function getDashboardSummary(token: string | null | undefined): DashboardSummary {
  requireUser(token)
  refreshOverdueStatuses()
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')

  const totalSalesRow = db
    .prepare<
      [],
      { v: number }
    >("SELECT COALESCE(SUM(total_amount),0) AS v FROM sales WHERE status != 'cancelled'")
    .get()

  const inventoryRow = db
    .prepare<[], { v: number }>(
      `SELECT COALESCE(SUM(i.quantity * p.cost_price),0) AS v
       FROM inventory i JOIN products p ON p.id = i.product_id
       WHERE i.condition IN ('new','used')`
    )
    .get()

  const treasuryInRow = db
    .prepare<
      [],
      { v: number }
    >("SELECT COALESCE(SUM(amount),0) AS v FROM treasury_entries WHERE type = 'in'")
    .get()
  const treasuryOutRow = db
    .prepare<
      [],
      { v: number }
    >("SELECT COALESCE(SUM(amount),0) AS v FROM treasury_entries WHERE type = 'out'")
    .get()
  const treasuryBalance = (treasuryInRow?.v ?? 0) - (treasuryOutRow?.v ?? 0)

  const supplierTotals = db
    .prepare<[], { total_purchases: number; total_paid: number }>(
      `SELECT
         (SELECT COALESCE(SUM(total_amount),0) FROM purchases WHERE status != 'cancelled') AS total_purchases,
         (SELECT COALESCE(SUM(amount),0) FROM supplier_payments) AS total_paid`
    )
    .get()
  const totalDueToSuppliers = Math.max(
    0,
    (supplierTotals?.total_purchases ?? 0) - (supplierTotals?.total_paid ?? 0)
  )

  const profitRow = db
    .prepare<[], { v: number }>(
      `SELECT COALESCE(SUM((si.unit_price - si.cost_price) * si.quantity),0) AS v
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.status != 'cancelled'`
    )
    .get()

  const badDebtRow = db
    .prepare<
      [],
      { v: number }
    >(`SELECT COALESCE(SUM(amount - paid_amount),0) AS v FROM installments WHERE status = 'waived'`)
    .get()

  const outstandingRow = db
    .prepare<[], { v: number }>(
      `SELECT COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments WHERE status NOT IN ('paid','waived')`
    )
    .get()

  const overdueRow = db
    .prepare<[string], { v: number }>(
      `SELECT COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments WHERE status NOT IN ('paid','waived') AND due_date < ?`
    )
    .get(today)

  const customersCount = db.prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM customers').get()
  const activeSalesCount = db
    .prepare<[], { c: number }>("SELECT COUNT(*) AS c FROM sales WHERE status = 'active'")
    .get()
  const overdueInstCount = db
    .prepare<[], { c: number }>("SELECT COUNT(*) AS c FROM installments WHERE status = 'overdue'")
    .get()

  return {
    total_sales_value: totalSalesRow?.v ?? 0,
    total_inventory_value: inventoryRow?.v ?? 0,
    total_paid_to_suppliers: supplierTotals?.total_paid ?? 0,
    total_due_to_suppliers: totalDueToSuppliers,
    treasury_balance: treasuryBalance,
    total_profit: profitRow?.v ?? 0,
    total_bad_debt: badDebtRow?.v ?? 0,
    outstanding_receivables: outstandingRow?.v ?? 0,
    overdue_receivables: overdueRow?.v ?? 0,
    customers_count: customersCount?.c ?? 0,
    active_sales_count: activeSalesCount?.c ?? 0,
    overdue_installments_count: overdueInstCount?.c ?? 0
  }
}

export function getSalesTrend(token: string | null | undefined, months = 6): SalesTrendPoint[] {
  requireUser(token)
  const db = getDb()
  const result: SalesTrendPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i))
    const nextMonthStart = startOfMonth(subMonths(new Date(), i - 1))
    const from = format(monthStart, 'yyyy-MM-dd')
    const to = format(nextMonthStart, 'yyyy-MM-dd')

    const sales = db
      .prepare<
        [string, string],
        { v: number }
      >("SELECT COALESCE(SUM(total_amount),0) AS v FROM sales WHERE status != 'cancelled' AND start_date >= ? AND start_date < ?")
      .get(from, to)
    const collections = db
      .prepare<
        [string, string],
        { v: number }
      >('SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE payment_date >= ? AND payment_date < ?')
      .get(from, to)
    const profit = db
      .prepare<[string, string], { v: number }>(
        `SELECT COALESCE(SUM((si.unit_price - si.cost_price) * si.quantity),0) AS v
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE s.status != 'cancelled' AND s.start_date >= ? AND s.start_date < ?`
      )
      .get(from, to)
    result.push({
      period: format(monthStart, 'yyyy-MM'),
      sales: sales?.v ?? 0,
      collections: collections?.v ?? 0,
      profit: profit?.v ?? 0
    })
  }
  return result
}

export function getOverdueAlerts(token: string | null | undefined): OverdueAlert[] {
  requireUser(token)
  refreshOverdueStatuses()
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  return db
    .prepare<[string], OverdueAlert>(
      `SELECT
         c.id AS customer_id,
         c.full_name AS customer_name,
         c.phone AS customer_phone,
         COALESCE(SUM(i.amount - i.paid_amount),0) AS total_overdue,
         COUNT(i.id) AS overdue_count,
         MIN(i.due_date) AS oldest_due_date
       FROM installments i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.status NOT IN ('paid','waived') AND i.due_date < ?
       GROUP BY c.id
       HAVING total_overdue > 0
       ORDER BY total_overdue DESC`
    )
    .all(today)
}

export function getUpcomingDue(token: string | null | undefined, windowDays = 7): Installment[] {
  requireUser(token)
  refreshOverdueStatuses()
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  const until = format(addDays(new Date(), windowDays), 'yyyy-MM-dd')
  return db
    .prepare<[string, string], Installment>(
      `SELECT i.*, c.full_name AS customer_name, s.invoice_number
       FROM installments i
       JOIN customers c ON c.id = i.customer_id
       JOIN sales s ON s.id = i.sale_id
       WHERE i.status NOT IN ('paid','waived') AND i.due_date >= ? AND i.due_date <= ?
       ORDER BY i.due_date ASC`
    )
    .all(today, until)
}

export function getCustomerOverdueAmount(customerId: number): number {
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  const row = db
    .prepare<[number, string], { v: number }>(
      `SELECT COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments WHERE customer_id = ? AND status NOT IN ('paid','waived') AND due_date < ?`
    )
    .get(customerId, today)
  return row?.v ?? 0
}

export function getSupplierBalances(token: string | null | undefined): Supplier[] {
  requireUser(token)
  const db = getDb()
  const rows = db.prepare<[], Supplier>('SELECT * FROM suppliers ORDER BY name ASC').all()
  return rows.map(s => {
    const totals = db
      .prepare<[number, number], { tp: number; pd: number }>(
        `SELECT
           (SELECT COALESCE(SUM(total_amount),0) FROM purchases WHERE supplier_id = ? AND status != 'cancelled') AS tp,
           (SELECT COALESCE(SUM(amount),0) FROM supplier_payments WHERE supplier_id = ?) AS pd`
      )
      .get(s.id, s.id)
    return {
      ...s,
      total_purchases: totals?.tp ?? 0,
      total_paid: totals?.pd ?? 0,
      balance_due: Math.max(0, (totals?.tp ?? 0) - (totals?.pd ?? 0))
    }
  })
}

export function getProfitLoss(
  token: string | null | undefined,
  rangeDays = 30
): { revenue: number; cost: number; profit: number; expenses: number; net: number } {
  requireUser(token)
  const db = getDb()
  const from = format(subDays(new Date(), rangeDays), 'yyyy-MM-dd')

  const revRow = db
    .prepare<
      [string],
      { v: number }
    >("SELECT COALESCE(SUM(total_amount),0) AS v FROM sales WHERE status != 'cancelled' AND start_date >= ?")
    .get(from)
  const costRow = db
    .prepare<[string], { v: number }>(
      `SELECT COALESCE(SUM(si.cost_price * si.quantity),0) AS v
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.status != 'cancelled' AND s.start_date >= ?`
    )
    .get(from)
  const expRow = db
    .prepare<
      [string],
      { v: number }
    >("SELECT COALESCE(SUM(amount),0) AS v FROM treasury_entries WHERE type = 'out' AND category = 'bad_debt' AND entry_date >= ?")
    .get(from)
  const revenue = revRow?.v ?? 0
  const cost = costRow?.v ?? 0
  const expenses = expRow?.v ?? 0
  const profit = revenue - cost
  return {
    revenue,
    cost,
    profit,
    expenses,
    net: profit - expenses
  }
}
