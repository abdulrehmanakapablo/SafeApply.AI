// ============================================================
// FILE: src/router/index.tsx
// ============================================================

import { createBrowserRouter } from 'react-router-dom'
import Root from '../components/layout/Root'

import Landing from '../pages/public/Landing'
import Login from '../pages/public/Login'
import Signup from '../pages/public/Signup'
import ForgotPassword from '../pages/public/ForgotPassword'
import ResetPassword from '../pages/public/ResetPassword'
import Pricing from '../pages/public/Pricing'
import About from '../pages/public/About'
import Blog from '../pages/public/Blog'
import BlogPost from '../pages/public/BlogPost'
import CompanySearch from '../pages/public/CompanySearch'
import CompanyDetail from '../pages/public/CompanyDetail'
import Terms from '../pages/public/Terms'
import Privacy from '../pages/public/Privacy'

import Dashboard from '../pages/dashboard/Dashboard'
import CompanyReport from '../pages/dashboard/CompanyReport'
import ReportHistory from '../pages/dashboard/ReportHistory'
import CVMatch from '../pages/dashboard/CVMatch'
import CVBuilder from '../pages/dashboard/CVBuilder'
import SavedCVs from '../pages/dashboard/SavedCVs'
import Tracker from '../pages/dashboard/Tracker'
import ApplicationDetail from '../pages/dashboard/ApplicationDetail'
import Analytics from '../pages/dashboard/Analytics'
import SubmitReview from '../pages/dashboard/SubmitReview'
import Settings from '../pages/dashboard/Settings'
import Billing from '../pages/dashboard/Billing'

import AdminDashboard from '../pages/admin/AdminDashboard'
import ReviewModeration from '../pages/admin/ReviewModeration'
import UserManagement from '../pages/admin/UserManagement'
import RevenueDashboard from '../pages/admin/RevenueDashboard'

import DashboardLayout from '../components/layout/DashboardLayout'
import AdminLayout from '../components/layout/AdminLayout'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import AdminRoute from '../components/shared/AdminRoute'

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      // ── Public routes ──────────────────────────────────
      { path: '/', element: <Landing /> },
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/reset-password/:token', element: <ResetPassword /> },
      { path: '/pricing', element: <Pricing /> },
      { path: '/about', element: <About /> },
      { path: '/blog', element: <Blog /> },
      { path: '/blog/:slug', element: <BlogPost /> },
      { path: '/terms', element: <Terms /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/companies', element: <CompanySearch /> },
      { path: '/companies/:slug', element: <CompanyDetail /> },

      // ── Dashboard routes ───────────────────────────────
      {
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/dashboard', element: <Dashboard /> },
          { path: '/dashboard/company-report', element: <CompanyReport /> },
          { path: '/dashboard/company-report/history', element: <ReportHistory /> },
          { path: '/dashboard/cv-match', element: <CVMatch /> },
          { path: '/dashboard/cv-builder', element: <CVBuilder /> },
          { path: '/dashboard/cv-builder/saved', element: <SavedCVs /> },
          { path: '/dashboard/tracker', element: <Tracker /> },
          { path: '/dashboard/tracker/:id', element: <ApplicationDetail /> },
          { path: '/dashboard/analytics', element: <Analytics /> },
          { path: '/dashboard/review', element: <SubmitReview /> },
          { path: '/dashboard/settings', element: <Settings /> },
          { path: '/dashboard/billing', element: <Billing /> },
        ],
      },

      // ── Admin routes ───────────────────────────────────
      {
        element: (
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        ),
        children: [
          { path: '/admin', element: <AdminDashboard /> },
          { path: '/admin/reviews', element: <ReviewModeration /> },
          { path: '/admin/users', element: <UserManagement /> },
          { path: '/admin/revenue', element: <RevenueDashboard /> },
        ],
      },
    ],
  },
])