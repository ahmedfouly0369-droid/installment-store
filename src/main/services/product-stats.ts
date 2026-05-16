import { getDb } from '../db'
import { requireUser } from './auth'
import type {
  ProductReturnStat,
  ProductSalesStat,
  ProductStatsFilters,
  ProductStatsReport,
  ProductStockStat
} from '@shared/types'

const BASE_COLUMNS = `
  p.id AS product_id,
  p.name_ar AS product_name_ar,
  p.name_en AS product_name_en,
  p.code AS code,
  p.brand_id AS brand_id,
  b.name_ar AS brand_name_ar,
  b.name_en AS brand_name_en,
  p.category_id AS category_id,
  c.name_ar AS category_name_ar,
  c.name_en AS category_name_en
`

function normalizeFilters(input: ProductStatsFilters): {
  from: string
  to: string
  category_id: number | null
  limit: number
} {
  const limit = Math.max(1, Math.min(50, input.limit ?? 10))
  return {
    from: input.from,
    to: input.to,
    category_id: input.category_id ?? null,
    limit
  }
}

function getMostSold(
  from: string,
  to: string,
  categoryId: number | null,
  limit: number,
  direction: 'DESC' | 'ASC'
): ProductSalesStat[] {
  const db = getDb()
  const params: Array<string | number> = [from, to]
  let categoryClause = ''
  if (categoryId !== null) {
    categoryClause = ' AND p.category_id = ?'
    params.push(categoryId)
  }
  params.push(limit)
  const rows = db
    .prepare<typeof params, ProductSalesStat>(
      `SELECT
         ${BASE_COLUMNS},
         COALESCE(SUM(si.quantity), 0) AS total_sold,
         COALESCE(SUM(si.total_price), 0) AS total_revenue
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN sales s ON s.id = si.sale_id
         AND s.status != 'cancelled'
         AND date(s.start_date) >= date(?)
         AND date(s.start_date) <= date(?)
       WHERE 1=1${categoryClause}
       GROUP BY p.id
       ORDER BY total_sold ${direction}, p.id ASC
       LIMIT ?`
    )
    .all(...params)
  return rows
}

function getMostReturned(
  from: string,
  to: string,
  categoryId: number | null,
  limit: number
): ProductReturnStat[] {
  const db = getDb()
  // returns are tracked via inventory movements (condition='returned')
  // We approximate returned quantity per product as the total quantity in
  // 'returned' condition rows. Date filter applies to inventory.updated_at when present.
  const params: Array<string | number> = []
  let categoryClause = ''
  if (categoryId !== null) {
    categoryClause = ' AND p.category_id = ?'
    params.push(categoryId)
  }
  // date filter on inventory.updated_at (string ISO/date)
  params.push(from, to)
  params.push(limit)
  const rows = db
    .prepare<typeof params, ProductReturnStat>(
      `SELECT
         ${BASE_COLUMNS},
         COALESCE(SUM(CASE
           WHEN i.condition = 'returned'
             AND (i.updated_at IS NULL OR (date(i.updated_at) >= date(?) AND date(i.updated_at) <= date(?)))
           THEN i.quantity ELSE 0 END), 0) AS total_returned
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE 1=1${categoryClause}
       GROUP BY p.id
       ORDER BY total_returned DESC, p.id ASC
       LIMIT ?`
    )
    .all(...params)
  return rows
}

function getSlowMoving(
  from: string,
  to: string,
  categoryId: number | null,
  limit: number
): ProductStockStat[] {
  const db = getDb()
  const params: Array<string | number> = [from, to]
  let categoryClause = ''
  if (categoryId !== null) {
    categoryClause = ' AND p.category_id = ?'
    params.push(categoryId)
  }
  params.push(limit)
  const rows = db
    .prepare<
      typeof params,
      {
        product_id: number
        product_name_ar: string
        product_name_en: string
        code: string | null
        brand_id: number
        brand_name_ar: string
        brand_name_en: string
        category_id: number
        category_name_ar: string
        category_name_en: string
        stock_qty: number
        total_sold: number
        last_sold_at: string | null
      }
    >(
      `SELECT
         ${BASE_COLUMNS},
         COALESCE((
           SELECT SUM(i.quantity) FROM inventory i
           WHERE i.product_id = p.id AND i.condition IN ('new','used')
         ), 0) AS stock_qty,
         COALESCE((
           SELECT SUM(si.quantity) FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           WHERE si.product_id = p.id
             AND s.status != 'cancelled'
             AND date(s.start_date) >= date(?)
             AND date(s.start_date) <= date(?)
         ), 0) AS total_sold,
         (
           SELECT MAX(s.start_date) FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           WHERE si.product_id = p.id AND s.status != 'cancelled'
         ) AS last_sold_at
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       WHERE 1=1${categoryClause}
       HAVING stock_qty > 0
       ORDER BY total_sold ASC, stock_qty DESC, p.id ASC
       LIMIT ?`
    )
    .all(...params)
  const today = new Date()
  return rows.map(r => {
    let daysSinceSold: number | null = null
    if (r.last_sold_at) {
      const sold = new Date(r.last_sold_at)
      if (!Number.isNaN(sold.getTime())) {
        daysSinceSold = Math.floor((today.getTime() - sold.getTime()) / 86400000)
      }
    }
    return { ...r, days_since_sold: daysSinceSold }
  })
}

export function getProductStatsReport(
  token: string | null | undefined,
  filters: ProductStatsFilters
): ProductStatsReport {
  requireUser(token)
  const { from, to, category_id, limit } = normalizeFilters(filters)
  const most_sold = getMostSold(from, to, category_id, limit, 'DESC')
  const least_sold_all = getMostSold(from, to, category_id, limit, 'ASC')
  // Skip products with 0 sales? Per spec they're still "least sold" if 0.
  // Keep them — that's the actual answer to "least sold".
  const most_returned = getMostReturned(from, to, category_id, limit)
  const slow_moving = getSlowMoving(from, to, category_id, limit)
  return {
    filters: { from, to, category_id },
    most_sold,
    least_sold: least_sold_all,
    most_returned,
    slow_moving
  }
}
