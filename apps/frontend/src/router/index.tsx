// FILE: src/router/index.tsx
// Public pages load eagerly. Dashboard + admin pages are code-split so
// first paint of the landing page doesn't carry the whole app.

import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import Root, { RouteError } from '../components/layout/Root'

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
import Jobs from '../pages/public/Jobs'
import JobDetail from '../pages/public/JobDetail'
import Terms from '../pages/public/Terms'
import Privacy from '../pages/public/Privacy'

import DashboardLayout from '../components/layout/DashboardLayout'
import AdminLayout from '../components/layout/AdminLayout'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import AdminRoute from '../components/shared/AdminRoute'

// Lazy page helper: React Router's `lazy` expects { Component }.
const page = (loader: () => Promise<{ default: React.ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await loader()).default }),
})

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
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
      { path: '/companies/:slug/hiring-record', ...page(() => import('../pages/public/HiringRecord')) },
      { path: '/methodology', ...page(() => import('../pages/public/Methodology')) },
      { path: '/leaderboards', ...page(() => import('../pages/public/Leaderboards')) },
      { path: '/leaderboards/:month', ...page(() => import('../pages/public/Leaderboards')) },
      { path: '/levels', ...page(() => import('../pages/public/Levels')) },
      { path: '/c/:slug/ghosting', ...page(() => import('../pages/public/CompanyGhosting')) },
      { path: '/c/:slug/interview-process', ...page(() => import('../pages/public/CompanyInterviews')) },
      { path: '/c/:slug/salaries', ...page(() => import('../pages/public/CompanySalaries')) },
      { path: '/share/search/:id', ...page(() => import('../pages/public/SharedReport')) },
      { path: '/share/employer/:slug', ...page(() => import('../pages/public/ShareEmployer')) },
      { path: '/jobs', element: <Jobs /> },
      { path: '/jobs/:id', element: <JobDetail /> },
      { path: '/recruiters', ...page(() => import('../pages/public/Recruiters')) },
      { path: '/freelance', ...page(() => import('../pages/public/Freelance')) },
      { path: '/projects', ...page(() => import('../pages/public/Projects')) },
      { path: '/projects/:id', ...page(() => import('../pages/public/ProjectDetail')) },
      { path: '/freelancers/:id', ...page(() => import('../pages/public/FreelancerProfile')) },
      { path: '/invite/:token', ...page(() => import('../pages/public/Invite')) },

      {
        element: (
          <ProtectedRoute portal="seeker">
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/dashboard', ...page(() => import('../pages/dashboard/Dashboard')) },
          { path: '/dashboard/company-report', ...page(() => import('../pages/dashboard/CompanyReport')) },
          { path: '/dashboard/company-report/history', ...page(() => import('../pages/dashboard/ReportHistory')) },
          { path: '/dashboard/company-report/:id', ...page(() => import('../pages/dashboard/CompanyReport')) },
          { path: '/dashboard/cv-match', ...page(() => import('../pages/dashboard/CVMatch')) },
          { path: '/dashboard/cv-builder', ...page(() => import('../pages/dashboard/CVBuilder')) },
          { path: '/dashboard/cv-builder/saved', ...page(() => import('../pages/dashboard/SavedCVs')) },
          { path: '/dashboard/tracker', ...page(() => import('../pages/dashboard/Tracker')) },
          { path: '/dashboard/tracker/:id', ...page(() => import('../pages/dashboard/ApplicationDetail')) },
          { path: '/dashboard/analytics', ...page(() => import('../pages/dashboard/Analytics')) },
          { path: '/dashboard/review', ...page(() => import('../pages/dashboard/SubmitReview')) },
          { path: '/dashboard/settings', ...page(() => import('../pages/dashboard/Settings')) },
          { path: '/dashboard/billing', ...page(() => import('../pages/dashboard/Billing')) },
          { path: '/dashboard/messages', ...page(() => import('../pages/dashboard/Messages')) },
          { path: '/dashboard/applications/:id', ...page(() => import('../pages/dashboard/JobApplication')) },
          { path: '/dashboard/interviews', ...page(() => import('../pages/interviews/InterviewList')) },
          { path: '/dashboard/messages/:id', ...page(() => import('../pages/dashboard/Messages')) },
        ],
      },

      {
        element: (
          <ProtectedRoute portal="recruiter">
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/recruiter', ...page(() => import('../pages/recruiter/Dashboard')) },
          { path: '/recruiter/jobs', ...page(() => import('../pages/recruiter/Jobs')) },
          { path: '/recruiter/jobs/new', ...page(() => import('../pages/recruiter/JobForm')) },
          { path: '/recruiter/jobs/:id', ...page(() => import('../pages/recruiter/JobPipeline')) },
          { path: '/recruiter/jobs/:id/edit', ...page(() => import('../pages/recruiter/JobForm')) },
          { path: '/recruiter/jobs/:id/close', ...page(() => import('../pages/recruiter/CloseJob')) },
          { path: '/recruiter/interviews', ...page(() => import('../pages/interviews/InterviewList')) },
          { path: '/recruiter/interviews/new', ...page(() => import('../pages/interviews/InterviewNew')) },
          { path: '/recruiter/applicants/:id', ...page(() => import('../pages/recruiter/Applicant')) },
          { path: '/recruiter/messages', ...page(() => import('../pages/recruiter/Messages')) },
          { path: '/recruiter/messages/:id', ...page(() => import('../pages/recruiter/Messages')) },
          { path: '/recruiter/company', ...page(() => import('../pages/recruiter/Company')) },
          { path: '/recruiter/reviews', ...page(() => import('../pages/recruiter/Reviews')) },
          { path: '/recruiter/settings', ...page(() => import('../pages/dashboard/Settings')) },
          { path: '/recruiter/billing', ...page(() => import('../pages/dashboard/Billing')) },
          { path: '/recruiter/team', ...page(() => import('../pages/recruiter/Team')) },
          { path: '/recruiter/team/invite', ...page(() => import('../pages/recruiter/TeamInvite')) },
          { path: '/recruiter/talent', ...page(() => import('../pages/recruiter/Talent')) },
          { path: '/recruiter/talent/saved', ...page(() => import('../pages/recruiter/TalentSaved')) },
          { path: '/recruiter/talent/:id', ...page(() => import('../pages/recruiter/TalentProfile')) },
          { path: '/recruiter/analytics', ...page(() => import('../pages/recruiter/Analytics')) },
          { path: '/team/join/:token', ...page(() => import('../pages/recruiter/TeamJoin')) },
        ],
      },

      {
        element: (
          <ProtectedRoute portal="freelancer">
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/freelancer', ...page(() => import('../pages/freelancer/Dashboard')) },
          { path: '/freelancer/proposals', ...page(() => import('../pages/freelancer/Proposals')) },
          { path: '/freelancer/profile', ...page(() => import('../pages/freelancer/Profile')) },
          { path: '/freelancer/contracts', ...page(() => import('../pages/freelance/Contracts')) },
          { path: '/freelancer/contracts/:id', ...page(() => import('../pages/freelance/Contract')) },
          { path: '/freelancer/settings', ...page(() => import('../pages/dashboard/Settings')) },
          { path: '/freelancer/work', ...page(() => import('../pages/freelancer/Work')) },
          { path: '/freelancer/clients/invite', ...page(() => import('../pages/freelancer/InviteClient')) },
          { path: '/freelancer/invoices', ...page(() => import('../pages/invoices/InvoiceList')) },
          { path: '/freelancer/invoices/:id', ...page(() => import('../pages/invoices/InvoicePage')) },
          { path: '/freelancer/billing', ...page(() => import('../pages/dashboard/Billing')) },
        ],
      },

      {
        element: (
          <ProtectedRoute portal="client">
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/client', ...page(() => import('../pages/client/Dashboard')) },
          { path: '/client/projects', ...page(() => import('../pages/client/Projects')) },
          { path: '/client/projects/new', ...page(() => import('../pages/client/ProjectForm')) },
          { path: '/client/projects/:id', ...page(() => import('../pages/client/ProjectManage')) },
          { path: '/client/projects/:id/edit', ...page(() => import('../pages/client/ProjectForm')) },
          { path: '/client/contracts', ...page(() => import('../pages/freelance/Contracts')) },
          { path: '/client/contracts/:id', ...page(() => import('../pages/freelance/Contract')) },
          { path: '/client/settings', ...page(() => import('../pages/dashboard/Settings')) },
          { path: '/client/invoices', ...page(() => import('../pages/invoices/InvoiceList')) },
          { path: '/client/invoices/:id', ...page(() => import('../pages/invoices/InvoicePage')) },
          { path: '/client/billing', ...page(() => import('../pages/dashboard/Billing')) },
        ],
      },

      {
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/billing/checkout', ...page(() => import('../pages/billing/Checkout')) },
          { path: '/billing/manual/:method', ...page(() => import('../pages/billing/ManualPayment')) },
          { path: '/billing/history', ...page(() => import('../pages/billing/History')) },
          { path: '/interviews/:id', ...page(() => import('../pages/interviews/InterviewDetail')) },
          { path: '/me/progress', ...page(() => import('../pages/me/Progress')) },
          { path: '/me/badges', ...page(() => import('../pages/me/Badges')) },
          { path: '/disputes', ...page(() => import('../pages/me/Disputes')) },
        ],
      },

      {
        element: (
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        ),
        children: [
          { path: '/admin', ...page(() => import('../pages/admin/AdminDashboard')) },
          { path: '/admin/trust', ...page(() => import('../pages/admin/Trust')) },
          { path: '/admin/disputes', ...page(() => import('../pages/admin/Disputes')) },
          { path: '/admin/payments', ...page(() => import('../pages/admin/Payments')) },
          { path: '/admin/budget', ...page(() => import('../pages/admin/Budget')) },
          { path: '/admin/projects', ...page(() => import('../pages/admin/Projects')) },
          { path: '/admin/companies', ...page(() => import('../pages/admin/CompanyVerification')) },
          { path: '/admin/reviews', ...page(() => import('../pages/admin/ReviewModeration')) },
          { path: '/admin/users', ...page(() => import('../pages/admin/UserManagement')) },
          { path: '/admin/revenue', ...page(() => import('../pages/admin/RevenueDashboard')) },
        ],
      },

      { path: '*', element: <RouteError /> },
    ],
  },
])
