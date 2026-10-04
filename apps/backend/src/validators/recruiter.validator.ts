import Joi from 'joi'

const text = (max: number) => Joi.string().trim().max(max).allow('')

export const companySchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  website: Joi.string().trim().max(200).uri({ scheme: ['http', 'https'] }).required().messages({
    'string.uri': 'Enter the full website, e.g. https://acme.com',
    'string.uriCustomScheme': 'Enter the full website, e.g. https://acme.com',
  }),
  industry: text(80),
  size: Joi.string().valid('', '1-10', '11-50', '51-200', '201-1000', '1000+').default(''),
  locations: text(200),
  about: text(3000),
})

const jobFields = {
  title: Joi.string().trim().min(3).max(120),
  description: Joi.string().trim().min(100).max(10000),
  location: text(120),
  work_mode: Joi.string().valid('onsite', 'hybrid', 'remote'),
  employment_type: Joi.string().valid('full_time', 'part_time', 'contract', 'internship'),
  salary_min: Joi.number().integer().min(0).max(100_000_000),
  salary_max: Joi.number().integer().min(0).max(100_000_000),
  currency: Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/),
  salary_period: Joi.string().valid('year', 'month', 'hour'),
  status: Joi.string().valid('draft', 'open', 'paused', 'closed'),
}

const salaryOrder = (value: { salary_min?: number; salary_max?: number }, helpers: Joi.CustomHelpers) =>
  value.salary_min !== undefined && value.salary_max !== undefined && value.salary_max < value.salary_min
    ? helpers.message({ custom: 'Maximum salary must be at least the minimum' })
    : value

export const createJobSchema = Joi.object({
  ...jobFields,
  title: jobFields.title.required(),
  description: jobFields.description.required(),
  work_mode: jobFields.work_mode.required(),
  employment_type: jobFields.employment_type.required(),
  salary_min: jobFields.salary_min.required().messages({ 'any.required': 'Salary range is required on SafeApply' }),
  salary_max: jobFields.salary_max.required().messages({ 'any.required': 'Salary range is required on SafeApply' }),
  currency: jobFields.currency.default('USD'),
  salary_period: jobFields.salary_period.default('year'),
  status: Joi.string().valid('draft', 'open').default('open'),
}).custom(salaryOrder)

export const updateJobSchema = Joi.object(jobFields).min(1).custom(salaryOrder)

export const stageSchema = Joi.object({
  stage: Joi.string().valid('applied', 'screening', 'interview', 'offer', 'hired', 'rejected').required(),
})

export const replySchema = Joi.object({
  body: Joi.string().trim().min(20).max(1500).required(),
})

export const applySchema = Joi.object({
  cv_text: Joi.string().trim().min(100).max(20000).required().messages({
    'string.min': 'Your CV needs at least 100 characters',
  }),
  cover_note: text(2000),
})

export const messageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
})

export const markReadSchema = Joi.object({
  ids: Joi.array().items(Joi.string().guid()).max(100),
  all: Joi.boolean(),
}).or('ids', 'all')

export const verifyCompanySchema = Joi.object({
  status: Joi.string().valid('verified', 'rejected').required(),
  note: text(500),
})

export const closeJobSchema = Joi.object({
  outcome: Joi.string().valid('hired_here', 'hired_elsewhere', 'not_hired', 'cancelled').required(),
  note: Joi.string().trim().max(500).allow('').default(''),
  hired_application_id: Joi.string().guid().when('outcome', { is: 'hired_here', then: Joi.required(), otherwise: Joi.forbidden() }),
})

export const penaltySchema = Joi.object({
  level: Joi.number().integer().min(0).max(3).allow(null).required(),
  reason: Joi.string().trim().max(500).allow('').default('').when('level', { is: Joi.number().min(1), then: Joi.string().trim().min(5).required() }),
})
