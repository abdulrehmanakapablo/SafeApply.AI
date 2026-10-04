import Joi from 'joi'

export const manualPaymentSchema = Joi.object({
  method: Joi.string().valid('jazzcash', 'easypaisa', 'bank').required(),
  transaction_id: Joi.string().trim().pattern(/^[A-Za-z0-9-]{6,40}$/).required().messages({ 'string.pattern.base': 'Use the transaction ID exactly as shown on your receipt (letters, numbers, dashes).' }),
  sender_name: Joi.string().trim().min(2).max(80).required(),
  amount_pkr: Joi.number().integer().min(1).max(1_000_000).required(),
})

export const reviewPaymentSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  note: Joi.string().trim().max(500).allow('').default(''),
})

export const budgetSchema = Joi.object({
  free_usd: Joi.number().min(0).max(100_000).precision(2).required(),
  hard_usd: Joi.number().min(0).max(100_000).precision(2).required(),
})
