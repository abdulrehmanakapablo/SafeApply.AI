import Joi from 'joi'

const slots = Joi.array().items(Joi.date().iso().raw()).min(1).max(5).unique().required()

export const createInterviewSchema = Joi.object({
  application_id: Joi.string().guid().required(),
  mode: Joi.string().valid('video', 'phone', 'onsite').required(),
  duration_min: Joi.number().integer().min(15).max(240).default(30),
  location: Joi.string().trim().max(300).allow('').default('').when('mode', { is: Joi.valid('phone', 'onsite'), then: Joi.string().trim().min(3).required() }),
  note: Joi.string().trim().max(1000).allow('').default(''),
  slots,
})
export const slotsSchema = Joi.object({ slots })
export const pickSlotSchema = Joi.object({ slot_id: Joi.string().guid().required() })
export const rescheduleSchema = Joi.object({ note: Joi.string().trim().max(500).allow('').default('') })
export const cancelInterviewSchema = Joi.object({ reason: Joi.string().trim().min(3).max(500).required() })
export const confirmSchema = Joi.object({ held: Joi.boolean().required() })
export const confirmHireSchema = Joi.object({ confirmed: Joi.boolean().required() })
