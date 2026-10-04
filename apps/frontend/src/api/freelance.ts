// FILE: src/api/freelance.ts
// PURPOSE: Freelance marketplace client: board, profiles, proposals,
//          client projects, contracts, milestones, messages, reviews.

import api from '../lib/axios'

type Ok<T> = { success: boolean; data: T; message?: string; error?: string }
export interface Page<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export type BudgetType = 'fixed' | 'hourly'
export type Duration = 'under_week' | 'one_month' | 'three_months' | 'longer'
export type ProjectStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'closed'
export type ProposalStatus = 'pending' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn'
export type ContractStatus = 'active' | 'completed' | 'cancelled'
export type MilestoneStatus = 'pending' | 'submitted' | 'revision' | 'approved'
export type Side = 'client' | 'freelancer' | 'admin'

export interface Project {
  id: string
  title: string
  description: string
  skills: string[]
  budget_type: BudgetType
  budget_min: number
  budget_max: number
  currency: string
  duration: Duration
  status: ProjectStatus
  last_activity_at: string
  created_at: string
  updated_at: string
  proposals_count?: number
  client_trust?: number
}
export interface ProjectDetail extends Project {
  proposals_count: number
  fresh: boolean
  client: { name: string; member_since: string | null; projects_posted: number; hires: number; trust_level: number }
  viewer: { is_owner: boolean; my_proposal: { id: string; status: ProposalStatus; amount: number; duration_days: number; created_at: string } | null }
}
export type ProjectInput = Pick<Project, 'title' | 'description' | 'skills' | 'budget_type' | 'budget_min' | 'budget_max' | 'currency' | 'duration'> & { status?: 'draft' | 'open' | 'closed' }

export interface FreelancerSummary {
  name: string
  headline: string
  skills: string[]
  rating: number | null
  reviews: number
  completed: number
  trust_level: number
}
export interface ClientProposal {
  id: string
  freelancer_id: string
  cover_letter: string
  amount: number
  duration_days: number
  status: ProposalStatus
  created_at: string
  freelancer: FreelancerSummary
}
export interface ClientProjectDetail extends Project {
  contract: { id: string; status: ContractStatus } | null
  proposals: ClientProposal[]
}
export interface MyProposal {
  id: string
  status: ProposalStatus
  amount: number
  duration_days: number
  created_at: string
  updated_at: string
  project: { id: string; title: string; status: ProjectStatus; currency: string; budget_type: BudgetType } | null
}

export interface Profile {
  headline: string
  bio: string
  skills: string[]
  hourly_rate: number | null
  currency: string
  location: string | null
  portfolio_url: string | null
  available: boolean
  updated_at?: string
}
export interface PublicFreelancer extends Profile {
  id: string
  name: string
  avatar_url: string | null
  member_since: string
  rating: number | null
  completed: number
  reviews: { id: string; rating: number; comment: string; created_at: string; reviewer: string }[]
  verified_work: { id: string; title: string; source: 'safeapply' | 'client_confirmed'; at: string }[]
  trust_level: number
  badges: import('./progress').EarnedBadge[]
}

export interface ContractRow {
  id: string
  project_id: string
  title: string
  amount: number
  currency: string
  status: ContractStatus
  created_at: string
  completed_at: string | null
  cancel_reason: string | null
  side: 'client' | 'freelancer'
  other_party: string
  milestones_total: number
  milestones_approved: number
  needs_action: boolean
}
export interface Milestone {
  id: string
  position: number
  title: string
  amount: number
  due_date: string | null
  status: MilestoneStatus
  note: string | null
  feedback: string | null
  submitted_at: string | null
  approved_at: string | null
}
export interface ContractDetail {
  id: string
  project_id: string
  title: string
  amount: number
  currency: string
  status: ContractStatus
  cancel_reason: string | null
  cancelled_by_side: 'client' | 'freelancer' | null
  created_at: string
  completed_at: string | null
  side: Side
  client: { name: string }
  freelancer: { id: string; name: string }
  milestones: Milestone[]
  reviews: { by: 'client' | 'freelancer'; rating: number; comment: string; created_at: string }[]
}
export interface ContractMessage {
  id: string
  body: string
  created_at: string
  mine: boolean
  from: 'client' | 'freelancer'
}

const B = '/freelance'

// Public
export const listProjects = async (params: { q?: string; skill?: string; budget_type?: string; page?: number }) => (await api.get<Page<Project>>(`${B}/projects`, { params })).data
export const getProject = async (id: string) => (await api.get<Ok<ProjectDetail>>(`${B}/projects/${id}`)).data
export const getFreelancer = async (id: string) => (await api.get<Ok<PublicFreelancer>>(`${B}/freelancers/${id}`)).data

// Freelancer
export const getMyProfile = async () => (await api.get<Ok<(Profile & { user_id: string }) | null>>(`${B}/me/profile`)).data
export const saveMyProfile = async (p: Omit<Profile, 'updated_at'>) => (await api.put<Ok<Profile & { user_id: string }>>(`${B}/me/profile`, p)).data
export const getFreelancerStats = async () =>
  (await api.get<Ok<{ has_profile: boolean; proposals_open: number; shortlisted: number; active: number; completed: number; approved_by_currency: Record<string, number> }>>(`${B}/me/stats`)).data
export const listMyProposals = async () => (await api.get<Ok<MyProposal[]>>(`${B}/me/proposals`)).data
export const sendProposal = async (projectId: string, p: { cover_letter: string; amount: number; duration_days: number }) =>
  (await api.post<Ok<ProjectDetail['viewer']['my_proposal']>>(`${B}/projects/${projectId}/proposals`, p)).data
export const withdrawProposal = async (id: string) => (await api.patch<Ok<{ id: string }>>(`${B}/proposals/${id}/withdraw`)).data

// Client
export const getClientStats = async () => (await api.get<Ok<{ open: number; drafts: number; new_proposals: number; active: number; completed: number }>>(`${B}/client/stats`)).data
export const listClientProjects = async () => (await api.get<Ok<Project[]>>(`${B}/client/projects`)).data
export const createProject = async (p: ProjectInput) => (await api.post<Ok<Project>>(`${B}/client/projects`, p)).data
export const getClientProject = async (id: string) => (await api.get<Ok<ClientProjectDetail>>(`${B}/client/projects/${id}`)).data
export const updateProject = async (id: string, p: Partial<ProjectInput>) => (await api.patch<Ok<Project>>(`${B}/client/projects/${id}`, p)).data
export const setProposalStatus = async (id: string, status: 'shortlisted' | 'declined') => (await api.patch<Ok<{ id: string; status: ProposalStatus }>>(`${B}/client/proposals/${id}`, { status })).data
export const hireProposal = async (id: string, milestones: { title: string; amount: number; due_date: string | null }[]) =>
  (await api.post<Ok<{ contract_id: string }>>(`${B}/client/proposals/${id}/hire`, { milestones })).data

// Contracts
export const listContracts = async () => (await api.get<Ok<ContractRow[]>>(`${B}/contracts`)).data
export const getContract = async (id: string) => (await api.get<Ok<ContractDetail>>(`${B}/contracts/${id}`)).data
export const submitMilestone = async (id: string, mid: string, note: string) => (await api.post<Ok<unknown>>(`${B}/contracts/${id}/milestones/${mid}/submit`, { note })).data
export const approveMilestone = async (id: string, mid: string) => (await api.post<Ok<{ contract_status: ContractStatus }>>(`${B}/contracts/${id}/milestones/${mid}/approve`)).data
export const requestRevision = async (id: string, mid: string, feedback: string) => (await api.post<Ok<unknown>>(`${B}/contracts/${id}/milestones/${mid}/revision`, { feedback })).data
export const cancelContract = async (id: string, reason: string) => (await api.post<Ok<unknown>>(`${B}/contracts/${id}/cancel`, { reason })).data
export const listContractMessages = async (id: string) => (await api.get<Ok<ContractMessage[]>>(`${B}/contracts/${id}/messages`)).data
export const postContractMessage = async (id: string, body: string) => (await api.post<Ok<ContractMessage>>(`${B}/contracts/${id}/messages`, { body })).data
export const reviewContract = async (id: string, rating: number, comment: string) => (await api.post<Ok<null>>(`${B}/contracts/${id}/review`, { rating, comment })).data

// Admin
export const adminListProjects = async (params: { status?: string; page?: number }) =>
  (await api.get<Page<Project & { client: { name: string; email: string } | null }>>(`${B}/admin/projects`, { params })).data
export const adminSetProject = async (id: string, status: 'open' | 'closed') => (await api.patch<Ok<{ id: string; status: ProjectStatus }>>(`${B}/admin/projects/${id}`, { status })).data

// Labels + formatting
export const DURATION_LABEL: Record<Duration, string> = { under_week: 'Under a week', one_month: 'Up to a month', three_months: '1 to 3 months', longer: 'Longer than 3 months' }
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = { draft: 'Draft', open: 'Open', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', closed: 'Closed' }
export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = { pending: 'Sent', shortlisted: 'Shortlisted', accepted: 'Hired', declined: 'Not selected', withdrawn: 'Withdrawn' }
export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = { pending: 'Not started', submitted: 'Handed in', revision: 'Changes requested', approved: 'Approved' }
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD']

export function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `${currency} ${n.toLocaleString()}`
  }
}
export const budgetLabel = (p: Pick<Project, 'budget_type' | 'budget_min' | 'budget_max' | 'currency'>) =>
  `${p.budget_min === p.budget_max ? money(p.budget_min, p.currency) : `${money(p.budget_min, p.currency)} to ${money(p.budget_max, p.currency)}`}${p.budget_type === 'hourly' ? ' / hour' : ' fixed'}`

// ─── Trust tools ────────────────────────────────────────────
export type ContactDetails = Contacts
export interface Contacts {
  client: { name: string; email: string | null; phone: string | null }
  freelancer: { name: string; email: string | null; phone: string | null; portfolio_url: string | null }
}
export type PayMethod = 'bank' | 'wallet' | 'cash' | 'card' | 'other'
export const PAY_METHOD_LABEL: Record<PayMethod, string> = { bank: 'Bank transfer', wallet: 'Mobile wallet', cash: 'Cash', card: 'Card', other: 'Other' }
export interface PaymentLog {
  id: string
  milestone_id: string | null
  amount: number
  method: PayMethod
  paid_on: string
  note: string | null
  confirmed: boolean | null
  confirmed_at: string | null
  created_at: string
  by: 'client' | 'freelancer'
  mine: boolean
}
export interface WorkItem {
  id: string
  title: string
  description: string | null
  amount: number | null
  currency: string
  completed_on: string | null
  status: 'pending_client' | 'verified' | 'declined'
  client_note: string | null
  verified_at: string | null
  created_at: string
  invite: { id: string; client_name: string; client_email: string; status: 'pending' | 'accepted' | 'declined' | 'revoked'; expires_at: string } | null
}
export interface InvitePreview {
  freelancer: { id: string; name: string }
  client_name: string
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'
  work: { title: string; description: string | null; amount: number | null; currency: string; completed_on: string | null } | null
}
export interface InvoiceItem {
  description: string
  qty: number
  unit_amount: number
}
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'
export interface Invoice {
  id: string
  freelancer_id: string
  contract_id: string | null
  client_id: string | null
  number: string
  client_name: string
  client_email: string | null
  items: InvoiceItem[]
  currency: string
  total: number
  notes: string | null
  status: InvoiceStatus
  issued_on: string
  due_on: string | null
  paid_on: string | null
  created_at: string
  freelancer_name?: string
}
export type InvoiceInput = Pick<Invoice, 'client_name' | 'items' | 'currency' | 'issued_on'> & { client_email?: string; notes?: string; due_on?: string; contract_id?: string }

export const getContacts = async (id: string) => (await api.get<Ok<Contacts>>(`${B}/contracts/${id}/contacts`)).data
export const listPaymentLogs = async (id: string) => (await api.get<Ok<PaymentLog[]>>(`${B}/contracts/${id}/payments`)).data
export const logPayment = async (id: string, p: { amount: number; method: PayMethod; paid_on: string; milestone_id?: string | null; note: string }) => (await api.post<Ok<{ id: string }>>(`${B}/contracts/${id}/payments`, p)).data
export const confirmPaymentLog = async (id: string, pid: string, confirmed: boolean) => (await api.patch<Ok<unknown>>(`${B}/contracts/${id}/payments/${pid}`, { confirmed })).data
export const getMyWork = async () => (await api.get<Ok<{ contracts: { id: string; title: string; amount: number; currency: string; completed_at: string; client: string }[]; work: WorkItem[] }>>(`${B}/me/work`)).data
export const createInvite = async (p: { client_name: string; client_email: string; title: string; description: string; amount: number | null; currency: string; completed_on: string | null }) =>
  (await api.post<Ok<{ id: string; link: string; emailed: boolean }>>(`${B}/me/invites`, p)).data
export const revokeInvite = async (id: string) => (await api.patch<Ok<unknown>>(`${B}/me/invites/${id}/revoke`)).data
export const getInvitePreview = async (token: string) => (await api.get<Ok<InvitePreview>>(`${B}/invites/${token}`)).data
export const respondInvite = async (token: string, confirmed: boolean, note: string) => (await api.post<Ok<{ status: string }>>(`${B}/invites/${token}/respond`, { confirmed, note })).data
export const listMyInvoices = async () => (await api.get<Ok<Invoice[]>>(`${B}/me/invoices`)).data
export const listClientInvoices = async () => (await api.get<Ok<Invoice[]>>(`${B}/client/invoices`)).data
export const getInvoice = async (id: string) => (await api.get<Ok<Invoice & { side: 'freelancer' | 'client'; from: { name: string; email: string } }>>(`${B}/invoices/${id}`)).data
export const createInvoice = async (p: InvoiceInput) => (await api.post<Ok<{ id: string; number: string }>>(`${B}/me/invoices`, p)).data
export const updateInvoice = async (id: string, p: Partial<InvoiceInput> & { status?: InvoiceStatus }) => (await api.patch<Ok<Invoice>>(`${B}/me/invoices/${id}`, p)).data
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void' }
