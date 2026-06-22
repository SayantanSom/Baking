import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthHashRedirect } from '@/components/auth/AuthHashRedirect'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute, SuperAdminRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { IngredientsPage } from '@/pages/IngredientsPage'
import { IngredientDetailPage } from '@/pages/IngredientDetailPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { VarietyDetailPage } from '@/pages/VarietyDetailPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { UserApprovalsPage } from '@/pages/UserApprovalsPage'

export default function App() {
  return (
    <>
      <AuthHashRedirect />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="ingredients/:id" element={<IngredientDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="products/:productId/varieties/:varietyId" element={<VarietyDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<SuperAdminRoute />}>
            <Route path="admin/users" element={<UserApprovalsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
