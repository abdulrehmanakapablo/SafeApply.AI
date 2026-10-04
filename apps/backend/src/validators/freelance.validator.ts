// ============================================================
// FILE: apps/backend/src/validators/freelance.validator.ts
// Limits mirror the CHECK constraints in supabase/003_freelance.sql so
// bad input fails here with a readable message, not in Postgres.
// ============================================================

import Joi from 'joi'

const text = (max: number) => Joi.string().trim().max(max).allow('')
const money = Joi.number().integer().min(1).max(10_000_000)
const currency = Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/).default('USD')
// Skills: short, plain tokens. Normalised to lowercase and de-duplicated.
const skill = Joi.string().trim().lowercase().min(1).max(30).pattern(/^[a-z0-9][a-z0-9 +#./-]*$/)
const skills = (max: number) => Joi.array().items(skill).max(max).unique().default([])

export const profileSchema = Joi.object({
  headline: Joi.string().trim().min(5).max(120).required(),
  bio: text(3000).default(''),
  skills: skills(15),
  hourly_rate: money.max(100_000).allow(null).default(null),
  currency,
  location: text(120).default(''),
  portfolio_url: Joi.string().trim().max(300).uri({ scheme: ['http', 'https'] }).allow('').default(''),
  available: Joi.boolean().default(true),
})

const projectFields = {
  title: Joi.string().trim().min(5).max(140),
  description: Joi.string().trim().min(50).max(10000),
  skills: skills(10),
  budget_type: Joi.string().valid('fixed', 'hourly'),
  budget_min: money,
  budget_max: money,
  currency,
  duration: Joi.string().valid('under_week', 'one_month', 'three_months', 'longer'),
}

export const createProjectSchema = Joi.object({
  ...projectFields,
  title: projectFields.title.required(),
  description: projectFields.description.required(),
  budget_type: projectFields.budget_type.required(),
  budget_min: projectFields.budget_min.required(),
  budget_max: projectFields.budget_max.required().min(Joi.ref('budget_min')).messages({ 'number.min': 'Maximum budget must be at least the minimum' }),
  duration: projectFields.duration.required(),
  status: Joi.string().valid('draft', 'open').default('open'),
})

export const updateProjectSchema = Joi.object({
  ...projectFields,
  currency: Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/),
  skills: Joi.array().items(skill).max(10).unique(),
  status: Joi.string().valid('draft', 'open', 'closed'),
}).min(1)

export const proposalSchema = Joi.object({
  cover_letter: Joi.string().trim().min(50).max(5000).required(),
  amount: money.required(),
  duration_days: Joi.number().integer().min(1).max(365).required(),
})

export const proposalStatusSchema = Joi.object({
  status: Joi.string().valid('shortlisted', 'declined').required(),
})

export const hireSchema = Joi.object({
  milestones: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().trim().min(3).max(140).required(),
        amount: money.required(),
        due_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null).default(null),
      }),
    )
    .min(1)
    .max(20)
    .required(),
})

export const submitMilestoneSchema = Joi.object({ note: text(2000).default('') })
export const revisionSchema = Joi.object({ feedback: Joi.string().trim().min(5).max(2000).required() })
export const cancelSchema = Joi.object({ reason: Joi.string().trim().min(5).max(1000).required() })
export const contractMessageSchema = Joi.object({ body: Joi.string().trim().min(1).max(4000).required() })
export const freelanceReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().min(20).max(1500).required(),
})
export const adminProjectSchema = Joi.object({ status: Joi.string().valid('open', 'closed').required() })

// ─── Trust tools ────────────────────────────────────────────
const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)

export const inviteSchema = Joi.object({
  client_name: Joi.string().trim().min(2).max(120).required(),
  client_email: Joi.string().trim().lowercase().email({ tlds: false }).max(254).required(),
  title: Joi.string().trim().min(3).max(140).required(),
  description: text(2000).default(''),
  amount: money.allow(null).default(null),
  currency,
  completed_on: isoDate.allow('', null).default(null),
})
export const respondInviteSchema = Joi.object({ confirmed: Joi.boolean().required(), note: text(500).default('') })

export const paymentLogSchema = Joi.object({
  amount: money.required(),
  method: Joi.string().valid('bank', 'wallet', 'cash', 'card', 'other').required(),
  paid_on: isoDate.required(),
  milestone_id: Joi.string().guid().allow(null, '').default(null),
  note: text(500).default(''),
})
export const confirmPaymentSchema = Joi.object({ confirmed: Joi.boolean().required() })

const item = Joi.object({
  description: Joi.string().trim().min(1).max(300).required(),
  qty: Joi.number().min(0.01).max(100000).precision(2).required(),
  unit_amount: Joi.number().integer().min(0).max(10_000_000).required(),
})
const invoiceFields = {
  contract_id: Joi.string().guid().allow(null, '').default(null),
  client_name: Joi.string().trim().min(2).max(120),
  client_email: Joi.string().trim().lowercase().email({ tlds: false }).max(254).allow('', null),
  items: Joi.array().items(item).min(1).max(50),
  currency: Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/),
  notes: text(2000),
  issued_on: isoDate,
  due_on: isoDate.allow('', null),
}
export const createInvoiceSchema = Joi.object({
  ...invoiceFields,
  client_name: invoiceFields.client_name.required(),
  items: invoiceFields.items.required(),
  currency: invoiceFields.currency.default('USD'),
  issued_on: invoiceFields.issued_on.required(),
})
export const updateInvoiceSchema = Joi.object({
  ...invoiceFields,
  contract_id: Joi.forbidden(),
  status: Joi.string().valid('draft', 'sent', 'paid', 'void'),
}).min(1)
