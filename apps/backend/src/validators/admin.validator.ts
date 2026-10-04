import Joi from 'joi'

export const updateReviewStatusSchema = Joi.object({
  status: Joi.string().valid('approved', 'flagged', 'deleted').required().messages({
    'any.required': 'Status is required',
  }),
})

export const updateUserSchema = Joi.object({
  plan: Joi.string().valid('free', 'pro', 'lifetime').optional(),
  role: Joi.string().valid('user', 'admin').optional(),
}).or('plan', 'role')
