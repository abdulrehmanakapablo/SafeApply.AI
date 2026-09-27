import Joi from 'joi'

export const uploadCVSchema = Joi.object({
  save_cv: Joi.boolean().optional().default(false),
})

export const matchCVSchema = Joi.object({
  cv_text: Joi.string().trim().min(100).max(15000).required().messages({
    'string.min': 'CV text is too short',
    'string.max': 'CV text exceeds maximum length',
    'any.required': 'CV text is required',
  }),
  jd_text: Joi.string().trim().min(50).max(10000).required().messages({
    'string.min': 'Job description is too short',
    'string.max': 'Job description exceeds maximum length',
    'any.required': 'Job description is required',
  }),
  save_cv: Joi.boolean().optional().default(false),
})

export const rewriteBulletSchema = Joi.object({
  original_bullet: Joi.string().trim().min(10).max(500).required().messages({
    'any.required': 'Original bullet point is required',
  }),
  jd_context: Joi.string().trim().max(2000).optional().default(''),
})

export const generateSummarySchema = Joi.object({
  background_text: Joi.string().trim().min(20).max(2000).required().messages({
    'any.required': 'Background text is required',
  }),
  target_role: Joi.string().trim().max(200).required().messages({
    'any.required': 'Target role is required',
  }),
})

export const saveCVSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'CV name is required',
  }),
  cv_data: Joi.object().required().messages({
    'any.required': 'CV data is required',
  }),
})