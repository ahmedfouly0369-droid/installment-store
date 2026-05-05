export type UserRole = 'admin' | 'accountant' | 'sales'

export interface User {
  id: number
  username: string
  full_name: string
  role: UserRole
  is_active: number
  created_at: string
}

export interface AuthSession {
  user: User
  token: string
}

export interface Category {
  id: number
  name_ar: string
  name_en: string
  icon: string | null
  created_at: string
}

export interface Brand {
  id: number
  category_id: number
  name_ar: string
  name_en: string
  created_at: string
  category_name_ar?: string
  category_name_en?: string
}

export interface Product {
  id: number
  category_id: number
  brand_id: number
  name_ar: string
  name_en: string
  model: string | null
  cost_price: number
  cash_price: number
  installment_price: number
  description: string | null
  created_at: string
  updated_at: string
  category_name_ar?: string
  category_name_en?: string
  brand_name_ar?: string
  brand_name_en?: string
  stock_qty?: number
}

export interface Warehouse {
  id: number
  name_ar: string
  name_en: string
  location: string | null
  created_at: string
}

export type ItemCondition = 'new' | 'used' | 'returned' | 'damaged'

export interface InventoryItem {
  id: number
  warehouse_id: number
  product_id: number
  condition: ItemCondition
  quantity: number
  notes: string | null
  created_at: string
  updated_at: string
  product_name_ar?: string
  product_name_en?: string
  warehouse_name_ar?: string
  warehouse_name_en?: string
  brand_name_ar?: string
  category_name_ar?: string
}

export type SupplierPaymentTerms = 'cash' | 'credit_30' | 'credit_60' | 'credit_90' | 'custom'

export interface Supplier {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  payment_terms: SupplierPaymentTerms
  notes: string | null
  created_at: string
  total_purchases?: number
  total_paid?: number
  balance_due?: number
}

export type PurchaseStatus = 'pending' | 'received' | 'partially_paid' | 'fully_paid' | 'cancelled'

export interface Purchase {
  id: number
  supplier_id: number
  warehouse_id: number
  invoice_number: string | null
  total_amount: number
  paid_amount: number
  purchase_date: string
  due_date: string | null
  status: PurchaseStatus
  notes: string | null
  created_by: number
  created_at: string
  supplier_name?: string
}

export interface PurchaseItem {
  id: number
  purchase_id: number
  product_id: number
  quantity: number
  unit_cost: number
  total_cost: number
  product_name_ar?: string
  product_name_en?: string
}

export interface SupplierPayment {
  id: number
  supplier_id: number
  purchase_id: number | null
  amount: number
  payment_date: string
  method: string
  notes: string | null
  created_by: number
  created_at: string
}

export interface Guarantor {
  id: number
  customer_id: number
  full_name: string
  national_id: string
  phone: string
  address: string | null
  relation: string | null
  workplace: string | null
  created_at: string
}

export interface GuarantorInput {
  full_name: string
  national_id: string
  phone: string
  address?: string | null
  relation?: string | null
  workplace?: string | null
}

export interface Customer {
  id: number
  full_name: string
  national_id: string
  phone: string
  alt_phone: string | null
  address: string | null
  workplace: string | null
  notes: string | null
  is_blacklisted: number
  created_at: string
  guarantors?: Guarantor[]
  total_sales?: number
  total_paid?: number
  outstanding_balance?: number
  overdue_balance?: number
}

export type SaleStatus = 'active' | 'completed' | 'defaulted' | 'cancelled'
export type SaleType = 'cash' | 'installment'

export interface Sale {
  id: number
  customer_id: number
  warehouse_id: number
  invoice_number: string
  type: SaleType
  total_amount: number
  down_payment: number
  remaining_amount: number
  installments_count: number
  installment_amount: number
  installment_period_days: number
  start_date: string
  status: SaleStatus
  notes: string | null
  created_by: number
  created_at: string
  customer_name?: string
  customer_phone?: string
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  quantity: number
  unit_price: number
  total_price: number
  cost_price: number
  product_name_ar?: string
  product_name_en?: string
}

export type InstallmentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'waived'

export interface Installment {
  id: number
  sale_id: number
  customer_id: number
  installment_number: number
  due_date: string
  amount: number
  paid_amount: number
  paid_date: string | null
  status: InstallmentStatus
  notes: string | null
  created_at: string
  customer_name?: string
  invoice_number?: string
}

export interface Payment {
  id: number
  customer_id: number
  sale_id: number | null
  installment_id: number | null
  amount: number
  payment_date: string
  method: string
  notes: string | null
  created_by: number
  created_at: string
  customer_name?: string
}

export interface TreasuryEntry {
  id: number
  type: 'in' | 'out'
  category: string
  amount: number
  reference_id: number | null
  reference_type: string | null
  description: string
  entry_date: string
  created_by: number
  created_at: string
}

export interface DashboardSummary {
  total_sales_value: number
  total_inventory_value: number
  total_paid_to_suppliers: number
  total_due_to_suppliers: number
  treasury_balance: number
  total_profit: number
  total_bad_debt: number
  outstanding_receivables: number
  overdue_receivables: number
  customers_count: number
  active_sales_count: number
  overdue_installments_count: number
}

export interface SalesTrendPoint {
  period: string
  sales: number
  collections: number
  profit: number
}

export interface OverdueAlert {
  customer_id: number
  customer_name: string
  customer_phone: string
  total_overdue: number
  overdue_count: number
  oldest_due_date: string
}
