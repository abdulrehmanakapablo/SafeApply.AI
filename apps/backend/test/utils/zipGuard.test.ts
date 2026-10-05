import { randomBytes } from 'crypto'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { zipWithinLimits } from '../../src/utils/zipGuard'

export async function zip(files: Record<string, string | Buffer>, compression: 'STORE' | 'DEFLATE' = 'DEFLATE'): Promise<Buffer> {
  const z = new JSZip()
  for (const [name, body] of Object.entries(files)) z.file(name, body)
  return z.generateAsync({ type: 'nodebuffer', compression })
}

describe('zipWithinLimits (F4)', () => {
  it('accepts a small normal docx-shaped zip', async () => {
    expect(zipWithinLimits(await zip({ 'word/document.xml': '<w:document/>', '[Content_Types].xml': '<Types/>' }))).toBe(true)
  })

  it('accepts a 10 MB incompressible entry', async () => {
    expect(zipWithinLimits(await zip({ 'word/media/a.png': randomBytes(10 * 1024 * 1024) }))).toBe(true)
  })

  it('accepts a stored (uncompressed) entry within the limit', async () => {
    expect(zipWithinLimits(await zip({ 'word/document.xml': Buffer.alloc(1024 * 1024) }, 'STORE'))).toBe(true)
  })

  it('rejects an entry that inflates past 40 MB', async () => {
    expect(zipWithinLimits(await zip({ 'word/document.xml': Buffer.alloc(50 * 1024 * 1024) }))).toBe(false)
  })

  it('rejects when many entries together pass 40 MB', async () => {
    const files: Record<string, Buffer> = {}
    for (let i = 0; i < 5; i++) files[`word/media/p${i}.bin`] = Buffer.alloc(9 * 1024 * 1024)
    expect(zipWithinLimits(await zip(files))).toBe(false)
  })

  it('rejects more than 1000 entries', async () => {
    const files: Record<string, string> = {}
    for (let i = 0; i < 1001; i++) files[`f${i}.txt`] = 'x'
    expect(zipWithinLimits(await zip(files))).toBe(false)
  })

  it('rejects a truncated archive', async () => {
    const z = await zip({ 'word/document.xml': '<w:document/>'.repeat(100) })
    expect(zipWithinLimits(z.subarray(0, Math.floor(z.length / 2)))).toBe(false)
  })

  it('rejects non-zip bytes', () => {
    expect(zipWithinLimits(Buffer.from('PK\x03\x04 not really a zip'))).toBe(false)
  })

  it('measures real inflated size, not the declared size', async () => {
    const bomb = await zip({ 'word/document.xml': Buffer.alloc(50 * 1024 * 1024) })
    // Lie in both the central directory (+24) and local header (+22) size fields.
    const cd = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    bomb.writeUInt32LE(100, cd + 24)
    bomb.writeUInt32LE(100, 22)
    expect(zipWithinLimits(bomb)).toBe(false)
  })
})
