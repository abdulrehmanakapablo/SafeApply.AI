import Joi from 'joi'

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5', 'uuidv7'] })
const text = (max: number) => Joi.string().trim().max(max).allow('')

export const teamInviteSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(254).required(),
})

export const teamJoinSchema = Joi.object({
  token: Joi.string().pattern(/^[A-Za-z0-9_-]{40,60}$/).required(),
})

export const noteSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
  rating: Joi.number().integer().min(1).max(5).allow(null).default(null),
  mentions: Joi.array().items(uuid).max(10).unique().default([]),
})

export const talentProfileSchema = Joi.object({
  visible: Joi.boolean().required(),
  open_to_work: Joi.boolean().required(),
  headline: text(120),
  skills: Joi.array().items(Joi.string().trim().lowercase().min(1).max(30)).max(20).unique().default([]),
  location: text(120),
  desired_roles: text(300),
  work_modes: Joi.array().items(Joi.string().valid('onsite', 'hybrid', 'remote')).max(3).unique().default([]),
  hidden_company_ids: Joi.array().items(uuid).max(20).unique().default([]),
})

export const folderSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).required(),
})

export const folderItemSchema = Joi.object({
  talent_id: uuid.required(),
  note: text(500),
})

export const talentInviteSchema = Joi.object({
  job_id: uuid.required(),
})
