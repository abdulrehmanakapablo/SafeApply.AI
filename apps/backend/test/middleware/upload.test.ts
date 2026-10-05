import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import { mockReq } from '../helpers/http'
import { verifyUpload } from '../../src/middleware/upload'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

async function docx(body: string | Buffer): Promise<Buffer> {
  const z = new JSZip()
  z.file('word/document.xml', body)
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

function run(buffer: Buffer) {
  const next = vi.fn()
  verifyUpload(mockReq({ file: { mimetype: DOCX, buffer } } as never), {} as never, next)
  return next
}

describe('verifyUpload DOCX bomb guard (F4)', () => {
  it('rejects a DOCX bomb with UPLOAD_REJECTED', async () => {
    const next = run(await docx(Buffer.alloc(50 * 1024 * 1024)))
    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0][0]?.code).toBe('UPLOAD_REJECTED')
    expect(next.mock.calls[0][0]?.message).toBe('That Word file is too big to read once unpacked. Save it again or upload a PDF.')
  })

  it('passes a normal DOCX through', async () => {
    const next = run(await docx('<w:document/>'))
    expect(next).toHaveBeenCalledWith()
  })
})
