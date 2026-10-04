// ============================================================
// FILE: apps/backend/src/utils/hash.ts
// PURPOSE: Password + token hashing.
// ============================================================

import bcrypt from 'bcrypt'
import crypto from 'crypto'

const SALT_ROUNDS = 12

// Pre-computed hash used to burn the same CPU time when an email doesn't
// exist, so response timing can't reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('safeapply-timing-equaliser', SALT_ROUNDS)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function burnPasswordCheck(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH)
}

export async function hashToken(token: string): Promise<string> {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function compareToken(token: string, hash: string): Promise<boolean> {
  const a = Buffer.from(await hashToken(token))
  const b = Buffer.from(hash)
  // timingSafeEqual throws on length mismatch; a malformed stored hash
  // must be a clean "no", not a 500.
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
