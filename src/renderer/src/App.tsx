import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Categories } from './pages/Categories'
import { Products } from './pages/Products'
import { Warehouses } from './pages/Warehouses'
import { Suppliers } from './pages/Suppliers'
import { SupplierDetail } from './pages/SupplierDetail'
import { Customers } from './pages/Customers'
import { CustomerDetail } from './pages/CustomerDetail'
import { Sales } from './pages/Sales'
import { SaleDetail } from './pages/SaleDetail'
import { Treasury } from './pages/Treasury'
import { Expenses } from './pages/Expenses'
import { Reports } from './pages/Reports'
import { Notifications } from './pages/Notifications'
import { Users } from './pages/Users'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="categories" element={<Categories />} />
        <Route path="products" element={<Products />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route
          path="suppliers"
          element={
            <ProtectedRoute roles={['admin', 'accountant']}>
              <Suppliers />
            </ProtectedRoute>
          }
        />
        <Route
          path="suppliers/:id"
          element={
            <ProtectedRoute roles={['admin', 'accountant']}>
              <SupplierDetail />
            </ProtectedRoute>
          }
        />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="sales" element={<Sales />} />
        <Route path="sales/:id" element={<SaleDetail />} />
        <Route
          path="treasury"
          element={
            <ProtectedRoute roles={['admin', 'accountant']}>
              <Treasury />
            </ProtectedRoute>
          }
        />
        <Route
          path="expenses"
          element={
            <ProtectedRoute roles={['admin', 'accountant']}>
              <Expenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={['admin', 'accountant']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route path="notifications" element={<Notifications />} />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}
