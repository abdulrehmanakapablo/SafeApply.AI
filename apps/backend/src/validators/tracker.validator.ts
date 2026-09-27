import Joi from 'joi'

export const createApplicationSchema = Joi.object({
  company_name: Joi.string().trim().min(1).max(200).required().messages({
    'any.required': 'Company name is required',
  }),
  job_title: Joi.string().trim().min(1).max(200).required().messages({
    'any.required': 'Job title is required',
  }),
  date_applied: Joi.string().isoDate().required().messages({
    'any.required': 'Application date is required',
    'string.isoDate': 'Invalid date format',
  }),
  job_link: Joi.string().trim().uri().optional().allow('').messages({
    'string.uri': 'Please enter a valid URL',
  }),
  // Integer bounds — prevents overflow attacks
  salary_min: Joi.number().integer().min(0).max(10000000).optional(),
  salary_max: Joi.number().integer().min(0).max(10000000).optional(),
  location: Joi.string().trim().max(200).optional().allow(''),
  status: Joi.string()
    .valid('saved', 'applied', 'screening', 'interviewing', 'offered', 'rejected', 'ghosted')
    .default('saved'),
  notes: Joi.string().trim().max(5000).optional().allow(''),
  jd_text: Joi.string().trim().max(10000).optional().allow(''),
})

export const updateApplicationSchema = Joi.object({
  company_name: Joi.string().trim().min(1).max(200).optional(),
  job_title: Joi.string().trim().min(1).max(200).optional(),
  date_applied: Joi.string().isoDate().optional(),
  job_link: Joi.string().trim().uri().optional().allow(''),
  salary_min: Joi.number().integer().min(0).max(10000000).optional(),
  salary_max: Joi.number().integer().min(0).max(10000000).optional(),
  location: Joi.string().trim().max(200).optional().allow(''),
  status: Joi.string()
    .valid('saved', 'applied', 'screening', 'interviewing', 'offered', 'rejected', 'ghosted')
    .optional(),
  notes: Joi.string().trim().max(5000).optional().allow(''),
  match_score: Joi.number().integer().min(0).max(100).optional(),
})

export const addCommunicationSchema = Joi.object({
  type: Joi.string()
    .valid('email', 'call', 'interview', 'follow_up', 'rejection')
    .required(),
  notes: Joi.string().trim().min(1).max(2000).required().messages({
    'any.required': 'Notes are required',
  }),
  date: Joi.string().isoDate().required().messages({
    'any.required': 'Date is required',
  }),
})