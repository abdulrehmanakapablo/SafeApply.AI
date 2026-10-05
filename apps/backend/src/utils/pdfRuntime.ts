// ============================================================
// FILE: apps/backend/src/utils/pdfRuntime.ts
// PURPOSE: pdf-parse (pdf.js) expects browser classes (DOMMatrix, ImageData,
//          Path2D) to exist the moment it loads. It tries to borrow them from
//          @napi-rs/canvas through a dynamic require that serverless bundlers
//          (Vercel) can't follow, so the package is left out and the whole
//          process crashes with "DOMMatrix is not defined".
//   1. Require @napi-rs/canvas here with a literal string, so the bundler
//      sees it and ships it, and install its classes globally.
//   2. If it still can't load, install tiny stand-ins. Text extraction never
//      draws anything, so identity-only classes are enough for it.
// Call preparePdfRuntime() before loading pdf-parse.
// ============================================================

let prepared = false

class DOMMatrixStub {
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0
  is2D = true
  isIdentity = true
  constructor(init?: number[]) {
    if (Array.isArray(init) && init.length >= 6) {
      ;[this.a, this.b, this.c, this.d, this.e, this.f] = init
      this.isIdentity = false
    }
  }
  multiplySelf(): this {
    return this
  }
  preMultiplySelf(): this {
    return this
  }
  translateSelf(): this {
    return this
  }
  scaleSelf(): this {
    return this
  }
  invertSelf(): this {
    return this
  }
  multiply(): DOMMatrixStub {
    return new DOMMatrixStub([this.a, this.b, this.c, this.d, this.e, this.f])
  }
  translate(): DOMMatrixStub {
    return this.multiply()
  }
  scale(): DOMMatrixStub {
    return this.multiply()
  }
  inverse(): DOMMatrixStub {
    return this.multiply()
  }
  transformPoint(p?: { x?: number; y?: number }) {
    return { x: p?.x ?? 0, y: p?.y ?? 0, z: 0, w: 1 }
  }
}

class ImageDataStub {
  constructor(
    public data: unknown,
    public width = 0,
    public height = 0,
  ) {}
}

class Path2DStub {}

export function preparePdfRuntime(): void {
  if (prepared) return
  prepared = true
  const g = globalThis as Record<string, unknown>
  try {
    // Literal require: keeps the native package in the serverless bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canvas = require('@napi-rs/canvas') as Record<string, unknown>
    for (const name of ['DOMMatrix', 'ImageData', 'Path2D']) {
      if (!g[name] && canvas[name]) g[name] = canvas[name]
    }
  } catch {
    /* not available on this host: stand-ins below */
  }
  if (!g.DOMMatrix) g.DOMMatrix = DOMMatrixStub
  if (!g.ImageData) g.ImageData = ImageDataStub
  if (!g.Path2D) g.Path2D = Path2DStub
}
