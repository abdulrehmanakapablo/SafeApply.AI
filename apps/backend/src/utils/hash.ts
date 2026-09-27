// ============================================================
// FILE: apps/backend/src/utils/hash.ts
// PURPOSE: bcrypt helpers for password hashing and comparison
// 12 salt rounds — strong enough for security, fast enough for UX
// Never store plain text passwords anywhere
// ============================================================

import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

// Hash a plain text password before storing in database
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Compare a plain text password against a stored hash
// Returns true if they match, false otherwise
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Hash a refresh token before storing in database
// Same function as password hash but named separately for clarity
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, SALT_ROUNDS)
}

// Compare a refresh token against its stored hash
export async function compareToken(
  token: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(token, hash)
}