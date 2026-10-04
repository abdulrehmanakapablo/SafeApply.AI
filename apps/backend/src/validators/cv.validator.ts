// ============================================================
// FILE: apps/backend/src/validators/cv.validator.ts
// ============================================================

import Joi from 'joi'

export const matchCVSchema = Joi.object({
  cv_text: Joi.string().min(50).max(20000).required(),
  jd_text: Joi.string().min(50).max(15000).required(),
  save_cv: Joi.boolean().optional(),
})

export const rewriteBulletSchema = Joi.object({
  original_bullet: Joi.string().min(5).max(2000).required(),
  jd_context: Joi.string().max(5000).allow('').optional(),
})

export const generateSummarySchema = Joi.object({
  background_text: Joi.string().min(10).max(5000).required(),
  target_role: Joi.string().min(2).max(200).required(),
})

export const structureCVSchema = Joi.object({
  cv_text: Joi.string().min(100).max(50000).required(),
  force: Joi.boolean().optional(),
})

// Saved CVs: the full CVData shape with hard caps on every string and list,
// so a saved CV can't be used to park megabytes of junk in the database.
const s = (max: number) => Joi.string().max(max).allow('')
const id = Joi.string().max(64).allow('')

const cvDataSchema = Joi.object({
  personal: Joi.object({
    full_name: s(120),
    job_title: s(120),
    email: s(254),
    phone: s(40),
    location: s(120),
    linkedin: s(300),
    github: s(300),
    summary: s(3000),
  }).required(),
  experience: Joi.array()
    .max(30)
    .items(
      Joi.object({
        id,
        company: s(200),
        role: s(200),
        start_date: s(40),
        end_date: s(40).allow(null),
        is_current: Joi.boolean(),
        bullets: Joi.array().max(20).items(s(1000)),
      }),
    )
    .default([]),
  education: Joi.array()
    .max(20)
    .items(Joi.object({ id, institution: s(200), degree: s(200), field: s(200), start_date: s(40), end_date: s(40) }))
    .default([]),
  skills: Joi.array().max(100).items(Joi.string().max(80)).default([]),
  projects: Joi.array()
    .max(30)
    .items(Joi.object({ id, name: s(200), description: s(3000), url: s(500), tech_stack: Joi.array().max(30).items(Joi.string().max(80)) }))
    .default([]),
  certifications: Joi.array()
    .max(30)
    .items(Joi.object({ id, name: s(200), issuer: s(200), date: s(40), url: s(500) }))
    .default([]),
})

export const saveCVSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  cv_data: cvDataSchema.required(),
})
