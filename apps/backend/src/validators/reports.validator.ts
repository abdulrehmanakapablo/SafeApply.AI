import Joi from 'joi'

export const analyzeReportSchema = Joi.object({
  jd_text: Joi.string().trim().max(10000).optional(),
  company_name: Joi.string().trim().max(200).optional(),
  job_title: Joi.string().trim().max(200).optional(),
}).or('jd_text', 'company_name') // At least one must be provided
  .messages({
    'object.missing': 'Please provide either a job description or a company name',
  })