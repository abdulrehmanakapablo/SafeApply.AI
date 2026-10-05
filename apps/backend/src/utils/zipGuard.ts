// ============================================================
// FILE: apps/backend/src/utils/zipGuard.ts
// PURPOSE: Reject ZIP-based uploads (DOCX) that unpack to far more than they
//          weigh ("zip bombs"). mammoth inflates the whole archive into
//          memory, so a 5 MB upload could otherwise grow to gigabytes.
// SECURITY: Sizes declared in ZIP headers are attacker-controlled, so every
//           deflated entry is actually inflated with a hard output cap.
//           Anything malformed, ZIP64 or using another compression method
//           is rejected.
// ============================================================

import { inflateRawSync } from 'zlib'

const EOCD_SIG = 0x06054b50
const CEN_SIG = 0x02014b50
const LOC_SIG = 0x04034b50
const EOCD_MIN = 22
const MAX_COMMENT = 0xffff

function findEocd(buf: Buffer): number {
  const stop = Math.max(0, buf.length - EOCD_MIN - MAX_COMMENT)
  for (let i = buf.length - EOCD_MIN; i >= stop; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  return -1
}

export function zipWithinLimits(
  buf: Buffer,
  { maxEntries = 1000, maxTotalBytes = 40 * 1024 * 1024 }: { maxEntries?: number; maxTotalBytes?: number } = {},
): boolean {
  try {
    const eocd = findEocd(buf)
    if (eocd < 0) return false
    const count = buf.readUInt16LE(eocd + 10)
    let cen = buf.readUInt32LE(eocd + 16)
    if (count === 0xffff || cen === 0xffffffff) return false // ZIP64
    if (count > maxEntries) return false

    let total = 0
    for (let n = 0; n < count; n++) {
      if (buf.readUInt32LE(cen) !== CEN_SIG) return false
      const method = buf.readUInt16LE(cen + 10)
      const compSize = buf.readUInt32LE(cen + 20)
      const nameLen = buf.readUInt16LE(cen + 28)
      const extraLen = buf.readUInt16LE(cen + 30)
      const commentLen = buf.readUInt16LE(cen + 32)
      const loc = buf.readUInt32LE(cen + 42)
      cen += 46 + nameLen + extraLen + commentLen

      if (buf.readUInt32LE(loc) !== LOC_SIG) return false
      const start = loc + 30 + buf.readUInt16LE(loc + 26) + buf.readUInt16LE(loc + 28)
      const end = start + compSize
      if (end > buf.length) return false

      const remaining = maxTotalBytes - total
      if (method === 0) {
        total += compSize
      } else if (method === 8) {
        // Throws RangeError once output would pass the cap.
        total += inflateRawSync(buf.subarray(start, end), { maxOutputLength: remaining + 1 }).length
      } else {
        return false
      }
      if (total > maxTotalBytes) return false
    }
    return true
  } catch {
    return false
  }
}
