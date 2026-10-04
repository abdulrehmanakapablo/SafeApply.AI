import Joi from 'joi'

export const analyzeReportSchema = Joi.object({
  jd_text: Joi.string().trim().max(10000).optional().allow(''),
  company_name: Joi.string().trim().max(200).optional().allow(''),
  job_title: Joi.string().trim().max(200).optional().allow(''),
})
  .or('jd_text', 'company_name')
  .messages({
    'object.missing': 'Please provide either a job description or a company name',
  })

export const demoExtractSchema = Joi.object({
  jd_text: Joi.string().trim().min(50).max(8000).required().messages({
    'string.min': 'Paste at least 50 characters.',
    'string.max': 'The free check accepts up to 8,000 characters.',
    'any.required': 'Job description is required',
  }),
})
