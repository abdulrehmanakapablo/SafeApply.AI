import Joi from 'joi'

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5', 'uuidv7'] })

export const disputeSchema = Joi.object({
  subject_type: Joi.string().valid('ghost_flag', 'penalty', 'trust_level', 'other').required(),
  subject_ref: uuid.allow(null).default(null),
  reason: Joi.string().trim().min(20).max(2000).required(),
  evidence_url: Joi.string().trim().max(500).uri({ scheme: ['https'] }).allow('', null).default(null),
})

export const resolveDisputeSchema = Joi.object({
  accept: Joi.boolean().required(),
  note: Joi.string().trim().max(1000).allow('').default(''),
})
