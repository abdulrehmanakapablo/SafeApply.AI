import Joi from 'joi'

export const trustOverrideSchema = Joi.object({
  override: Joi.number().integer().min(0).max(4).allow(null).required(),
  reason: Joi.string().trim().min(3).max(500).required(),
})
