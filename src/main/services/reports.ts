import { addDays, format, startOfMonth, subDays, subMonths } from 'date-fns'
import { getDb } from '../db'
import { requireUser } from './auth'
import { refreshOverdueStatuses } from './sales'
import { getBadDebtThresholdDays, getOverdueMinDays } from './settings'
import type {
  DashboardSummary,
  Installment,
  InstallmentDueRow,
  InstallmentRangeReport,
  NotificationSummary,
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

  const badDebtThreshold = getBadDebtThresholdDays()
  const badDebtCutoff = format(subDays(new Date(), badDebtThreshold), 'yyyy-MM-dd')

  const badDebtRow = db
    .prepare<[string], { v: number }>(
      `SELECT COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments
       WHERE (status = 'waived')
          OR (status NOT IN ('paid','waived') AND due_date < ?)`
    )
    .get(badDebtCutoff)

  const outstandingRow = db
    .prepare<[], { v: number }>(
      `SELECT COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments WHERE status NOT IN ('paid','waived')`
    )
    .get()

  const overdueRow = db
    .prepare<[string, string], { v: number }>(
      `SELECT COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments
       WHERE status NOT IN ('paid','waived') AND due_date < ? AND due_date >= ?`
    )
    .get(today, badDebtCutoff)

  const customersCount = db.prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM customers').get()
  const activeSalesCount = db
    .prepare<[], { c: number }>("SELECT COUNT(*) AS c FROM sales WHERE status = 'active'")
    .get()
  const overdueInstCount = db
    .prepare<[string, string], { c: number }>(
      `SELECT COUNT(*) AS c FROM installments
       WHERE status NOT IN ('paid','waived') AND due_date < ? AND due_date >= ?`
    )
    .get(today, badDebtCutoff)

  const expensesRow = db
    .prepare<[], { v: number }>('SELECT COALESCE(SUM(amount),0) AS v FROM expenses')
    .get()
  const grossProfit = profitRow?.v ?? 0
  const totalExpenses = expensesRow?.v ?? 0

  return {
    total_sales_value: totalSalesRow?.v ?? 0,
    total_inventory_value: inventoryRow?.v ?? 0,
    total_paid_to_suppliers: supplierTotals?.total_paid ?? 0,
    total_due_to_suppliers: totalDueToSuppliers,
    treasury_balance: treasuryBalance,
    total_profit: grossProfit,
    total_bad_debt: badDebtRow?.v ?? 0,
    outstanding_receivables: outstandingRow?.v ?? 0,
    overdue_receivables: overdueRow?.v ?? 0,
    customers_count: customersCount?.c ?? 0,
    active_sales_count: activeSalesCount?.c ?? 0,
    overdue_installments_count: overdueInstCount?.c ?? 0,
    total_expenses: totalExpenses,
    net_profit: grossProfit - totalExpenses
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
    >('SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE expense_date >= ?')
    .get(from)
  const badDebtRow = db
    .prepare<
      [string],
      { v: number }
    >("SELECT COALESCE(SUM(amount - paid_amount),0) AS v FROM installments WHERE status = 'waived' AND COALESCE(paid_date, due_date) >= ?")
    .get(from)
  const revenue = revRow?.v ?? 0
  const cost = costRow?.v ?? 0
  const expensesTotal = (expRow?.v ?? 0) + (badDebtRow?.v ?? 0)
  const profit = revenue - cost
  return {
    revenue,
    cost,
    profit,
    expenses: expensesTotal,
    net: profit - expensesTotal
  }
}

const DUE_ROW_SQL = `SELECT
  i.id AS id,
  i.sale_id AS sale_id,
  i.customer_id AS customer_id,
  c.full_name AS customer_name,
  c.phone AS customer_phone,
  s.invoice_number AS invoice_number,
  i.installment_number AS installment_number,
  i.due_date AS due_date,
  i.amount AS amount,
  i.paid_amount AS paid_amount,
  (i.amount - i.paid_amount) AS remaining,
  CAST((julianday(?) - julianday(i.due_date)) AS INTEGER) AS days_overdue
 FROM installments i
 JOIN customers c ON c.id = i.customer_id
 JOIN sales s ON s.id = i.sale_id`

function emptyReport(): InstallmentRangeReport {
  return { rows: [], total: 0, count: 0 }
}

function aggregateRows(rows: InstallmentDueRow[]): InstallmentRangeReport {
  const total = rows.reduce((s, r) => s + r.remaining, 0)
  return { rows, total: Math.round(total * 100) / 100, count: rows.length }
}

export function getInstallmentsByRange(
  token: string | null | undefined,
  filters: { from: string; to: string }
): InstallmentRangeReport {
  requireUser(token)
  refreshOverdueStatuses()
  if (!filters.from || !filters.to) return emptyReport()
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  const rows = db
    .prepare<[string, string, string], InstallmentDueRow>(
      `${DUE_ROW_SQL}
       WHERE i.status NOT IN ('paid','waived')
         AND i.due_date >= ? AND i.due_date <= ?
       ORDER BY i.due_date ASC, c.full_name ASC`
    )
    .all(today, filters.from, filters.to)
  return aggregateRows(rows)
}

export function getOverdueInstallments(token: string | null | undefined): InstallmentRangeReport {
  requireUser(token)
  refreshOverdueStatuses()
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  const threshold = getBadDebtThresholdDays()
  const minDays = Math.max(1, getOverdueMinDays())
  const overdueCutoff = format(subDays(new Date(), minDays), 'yyyy-MM-dd')
  const badDebtCutoff = format(subDays(new Date(), threshold), 'yyyy-MM-dd')
  const rows = db
    .prepare<[string, string, string], InstallmentDueRow>(
      `${DUE_ROW_SQL}
       WHERE i.status NOT IN ('paid','waived')
         AND i.due_date <= ? AND i.due_date > ?
       ORDER BY i.due_date ASC, c.full_name ASC`
    )
    .all(today, overdueCutoff, badDebtCutoff)
  return aggregateRows(rows)
}

export function getBadDebtInstallments(token: string | null | undefined): InstallmentRangeReport {
  requireUser(token)
  refreshOverdueStatuses()
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  const threshold = getBadDebtThresholdDays()
  const badDebtCutoff = format(subDays(new Date(), threshold), 'yyyy-MM-dd')
  const rows = db
    .prepare<[string, string], InstallmentDueRow>(
      `${DUE_ROW_SQL}
       WHERE (i.status = 'waived')
          OR (i.status NOT IN ('paid','waived') AND i.due_date <= ?)
       ORDER BY i.due_date ASC, c.full_name ASC`
    )
    .all(today, badDebtCutoff)
  return aggregateRows(rows)
}

export function getNotificationSummary(token: string | null | undefined): NotificationSummary {
  requireUser(token)
  refreshOverdueStatuses()
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  const threshold = getBadDebtThresholdDays()
  const minDays = Math.max(1, getOverdueMinDays())
  const overdueCutoff = format(subDays(new Date(), minDays), 'yyyy-MM-dd')
  const badDebtCutoff = format(subDays(new Date(), threshold), 'yyyy-MM-dd')
  const inWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  const overdueAgg = db
    .prepare<[string, string], { c: number; v: number }>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments
       WHERE status NOT IN ('paid','waived') AND due_date <= ? AND due_date > ?`
    )
    .get(overdueCutoff, badDebtCutoff)

  const badDebtAgg = db
    .prepare<[string], { c: number; v: number }>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments
       WHERE (status = 'waived')
          OR (status NOT IN ('paid','waived') AND due_date <= ?)`
    )
    .get(badDebtCutoff)

  const upcomingAgg = db
    .prepare<[string, string], { c: number; v: number }>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(amount - paid_amount),0) AS v
       FROM installments
       WHERE status NOT IN ('paid','waived') AND due_date >= ? AND due_date <= ?`
    )
    .get(today, inWeek)

  return {
    overdue_count: overdueAgg?.c ?? 0,
    overdue_total: overdueAgg?.v ?? 0,
    bad_debt_count: badDebtAgg?.c ?? 0,
    bad_debt_total: badDebtAgg?.v ?? 0,
    upcoming_count: upcomingAgg?.c ?? 0,
    upcoming_total: upcomingAgg?.v ?? 0,
    overdue_threshold_days: threshold
  }
}
