// ============================================================
// FILE: apps/backend/src/pdfGlobals.ts
// PURPOSE: Must be the FIRST import of app.ts. Installs the browser classes
//          pdf.js needs (DOMMatrix, ImageData, Path2D) before any other
//          module loads, so pdf-parse can never crash the process at startup,
//          no matter which file loads it or when.
// ============================================================

import { preparePdfRuntime } from './utils/pdfRuntime'

preparePdfRuntime()
