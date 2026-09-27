import Joi from 'joi'

export const createReviewSchema = Joi.object({
  company_name: Joi.string().trim().min(1).max(200).required().messages({
    'any.required': 'Company name is required',
  }),
  relationship: Joi.string()
    .valid('current_employee', 'former_employee', 'applicant', 'knows_someone')
    .required().messages({
      'any.required': 'Please select your relationship to this company',
    }),
  role_type: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Role type is required',
  }),
  overall_rating: Joi.number().integer().min(1).max(5).required().messages({
    'any.required': 'Overall rating is required',
    'number.min': 'Rating must be between 1 and 5',
    'number.max': 'Rating must be between 1 and 5',
  }),
  culture_rating: Joi.number().integer().min(1).max(5).required(),
  interview_rating: Joi.number().integer().min(1).max(5).required(),
  would_recommend: Joi.string().valid('yes', 'no', 'maybe').required().messages({
    'any.required': 'Please indicate if you would recommend this company',
  }),
  review_text: Joi.string().trim().min(100).max(2000).required().messages({
    'string.min': 'Review must be at least 100 characters',
    'string.max': 'Review must be less than 2000 characters',
    'any.required': 'Review text is required',
  }),
  interview_process: Joi.string().trim().max(2000).optional().allow(''),
  salary_min: Joi.number().integer().min(0).max(10000000).optional(),
  salary_max: Joi.number().integer().min(0).max(10000000).optional(),
})