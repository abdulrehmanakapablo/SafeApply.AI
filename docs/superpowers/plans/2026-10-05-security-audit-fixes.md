# SafeApply Security Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining security defects found in the 2026-10-05 audit of the `security-fixes` branch, each pinned by a regression test.

**Architecture:** The backend (Express 5, `apps/backend`) talks to Supabase only through the service-role client `supabaseAdmin`. RLS is on for every table with all `anon`/`authenticated` grants revoked (`supabase/security.sql`), so the backend is the only gate. The fixes stay inside the existing middleware/controller/util layout. A Vitest harness is added first because the backend has no tests today.

**Tech Stack:** Node 24, pnpm workspace (`packageManager: pnpm@12.4.1`), Express 5, TypeScript 5, Joi, `@supabase/supabase-js` 2.116, express-rate-limit 8, mammoth, multer. Test-only additions: vitest, supertest, jszip.

**Spec:** No separate spec. The "Audit Findings" section below is the spec. Each finding names the task that fixes it.

## Audit Findings

Baseline already in place, verified, and not re-done here: helmet with deny-all CSP, CORS allowlist plus an Origin check on writes, `trust proxy` set by hop count, JWT pinned to HS256 with iss/aud/typ checks, refresh rotation with reuse revocation, an httpOnly SameSite=Strict refresh cookie, bcrypt cost 12 with a timing equaliser, Joi `stripUnknown` on bodies, upload magic-byte checks, ownership filters on tracker/reports/cv/notifications/shares, party checks on contracts/interviews/messages, RLS plus revoked grants on all 44 tables, a production CSP meta tag on the frontend, and `safeUrl`/`safeHref` on user links.

| # | Severity | Finding | Where | Task |
|---|----------|---------|-------|------|
| F1 | Critical | `supabaseAdmin.auth.signInWithPassword` stores the user's session on the shared service-role client. supabase-js `_getAccessToken()` then prefers that session JWT over the service key (see `node_modules/.pnpm/@supabase+supabase-js@2.116.0*/.../dist/index.cjs:825-836`). As a result, every later `supabaseAdmin` query, from every request, runs as role `authenticated`. With grants revoked, all queries fail, `authMiddleware` returns 401 "User not found" for everyone, and this lasts until the process restarts. The trigger is any password change, or any login whose bcrypt mirror is stale. | `controllers/auth.controller.ts:214`, `:514` | 2 |
| F2 | High | `DELETE /api/auth/me` asks only for the string `DELETE`. A stolen 15-minute access token (it lives in `localStorage`) is enough to destroy the account permanently. | `controllers/auth.controller.ts:594`, `validators/auth.validator.ts:124` | 3 |
| F3 | Medium | The login limiter keys on IP+email (5 per 15 min). An attacker rotating IPs can guess one account's password without limit. | `middleware/rateLimiter.ts:37` | 4 |
| F4 | Medium | DOCX upload has a 5 MB compressed cap but no limit on uncompressed size. mammoth inflates the whole archive into memory. The 15 s timeout does not bound memory, so a zip bomb can OOM the process. | `middleware/upload.ts:46`, `services/pdf.service.ts:53` | 5 |
| F5 | Low | Tracker `:id` params are not UUID-checked. Malformed ids reach Postgres and return as 500s, which is noise in the error logs and uses a different code path than every other controller. | `controllers/tracker.controller.ts:116,162,213,242` | 6 |
| F6 | Medium | Runtime dependency advisory: `ip-address <=10.7.0`, pulled in through `express-rate-limit` (GHSA-j6r3-76f7-8jcv, plus an unbounded-diagnostic DoS). The dev-only advisories are `brace-expansion` (eslint) and `braces` (ts-node-dev, no patched version). | `pnpm-lock.yaml` | 7 |
| — | Info | The semgrep `regex_dos` hits (`groq.service.ts:308-312`, `progress.controller.ts:125`) and the `node_password` hits (Login/Signup.tsx) are false positives: the regexes are linear and the hits are form state. No action. | `.sec-audit/raw/semgrep.json` | — |

Deferred: these need a decision from the owner and are not tasks in this plan.
- **Access token in `localStorage`.** Moving it to memory only (restored through `/api/auth/refresh` on load) removes the XSS token-theft path. It touches `lib/axios.ts`, `api/cv.ts` streaming and `store/authStore.ts`. Do it as a separate plan.
- **Frontend response headers.** A meta CSP cannot set `frame-ancestors`. Clickjacking protection and HSTS for the SPA must come from the static host (Vercel/Netlify/Cloudflare). Which host is in use is unknown.
- **Rate-limit store is in-memory.** It is fine for one instance. It needs a Redis store before scaling out.
- **Signup returns 409 for existing emails.** This is account enumeration, but it is a UX trade-off and the signup limiter (5/h/IP) already bounds it.

## Global Constraints

- No new runtime dependencies. New devDependencies are limited to `vitest`, `supertest`, `@types/supertest` and `jszip`, in `apps/backend` only.
- User-facing error copy follows existing style: a plain sentence, curly apostrophe `’`, no internal detail.
- Do not log passwords, tokens, CV text or request bodies. This matches `middleware/errorHandler.ts`.
- All backend tests run with `pnpm --filter @safeapply/backend test` and must not reach the network or a real Supabase.
- Work on branch `security-fixes`. Each task ends in one commit whose message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Other requests running while a fallback login or password change happens.** Expected: service-role queries keep working, and nothing ever signs in on `supabaseAdmin`. Pinned by the static guard test in Task 2.
2. **A user whose bcrypt mirror is stale (`'!'` or a mismatch) changes their password or deletes their account.** Expected: verification goes through the isolated Supabase check and succeeds. Pinned in Task 2 (changePassword) and Task 3 (delete).
3. **A legitimate image-heavy DOCX (about 4 MB compressed, up to about 30 MB unpacked).** Expected: it still uploads. Pinned in Task 5 by the "10 MB incompressible entry passes" test.
4. **The same account typed as `Victim@X.com ` from one IP and `victim@x.com` from another.** Expected: both attempts count against one per-account bucket. Pinned in Task 4.
5. **A failed-login flood against one email.** Expected: it does not lock out other emails. The cost of locking out the target email for one hour is accepted. Pinned in Task 4.

---

### Task 1: Backend test harness

**Files:**
- Modify: `apps/backend/package.json` (add `"test": "vitest run"`, devDeps `vitest@^3`, `supertest@^7`, `@types/supertest@^6`, `jszip@^3`)
- Create: `apps/backend/vitest.config.ts`
- Create: `apps/backend/test/setup.ts`
- Create: `apps/backend/test/helpers/http.ts`
- Create: `apps/backend/test/helpers/supabaseMock.ts`
- Test: `apps/backend/test/utils/hash.test.ts`

**Interfaces:**
- Produces:
  - `mockReq(over?: Partial<Request>): Request`. Defaults: `body: {}`, `params: {}`, `query: {}`, `headers: {}`, `cookies: {}`, `user: { userId: 'u-1', email: 'a@b.co', role: 'user', plan: 'free' }`.
  - `mockRes(): { res: Response; statusCode(): number; body(): any }`. `status`, `json`, `cookie` and `clearCookie` are chainable `vi.fn`s.
  - `createSupabaseMock(): { client; queue(table: string, result: { data: unknown; error: unknown }): void; calls: { table: string; method: string; args: unknown[] }[] }`. `client.from(table)` returns a chain where every builder method returns the chain and records itself in `calls`. Awaiting the chain, or calling `.single()`/`.maybeSingle()`, resolves to the next queued result for that table, or `{ data: null, error: null }` if none is queued. `client.auth` has `vi.fn`s `signInWithPassword`, `getUser`, `resetPasswordForEmail`, `admin.deleteUser`, `admin.updateUserById` and `admin.createUser`, each resolving `{ data: {}, error: null }` by default. `client.storage.from()` returns `{ upload: vi.fn() }`.

- [ ] **Step 1: Add devDeps and the script, and write `vitest.config.ts`**

`environment: 'node'`, `setupFiles: ['./test/setup.ts']`, `include: ['test/**/*.test.ts']`. Then run `pnpm install`.

- [ ] **Step 2: Write `test/setup.ts`**

It sets `process.env` before any `src` import: `SUPABASE_URL=http://localhost:54321`, `SUPABASE_ANON_KEY=anon-test-key`, `SUPABASE_SERVICE_ROLE_KEY=service-test-key`, `JWT_SECRET` = `'a'.repeat(40)`, `JWT_REFRESH_SECRET` = `'b'.repeat(40)`, `PORT=0`, `FRONTEND_URL=http://localhost:5173`, `NODE_ENV=test`.

- [ ] **Step 3: Write the helpers and a smoke test**

```ts
// test/utils/hash.test.ts
it('compareToken matches its own hash and rejects a malformed one', async () => {
  const h = await hashToken('abc')
  expect(await compareToken('abc', h)).toBe(true)
  expect(await compareToken('abc', 'short')).toBe(false)
})
```

- [ ] **Step 4: Run it**

Run: `pnpm --filter @safeapply/backend test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json apps/backend/vitest.config.ts apps/backend/test pnpm-lock.yaml
git commit -m "test(backend): add vitest harness with supabase and http mocks"
```

---

### Task 2 (F1, Critical): Isolate Supabase password checks from the service-role client

**Files:**
- Create: `apps/backend/src/utils/passwordCheck.ts`
- Modify: `apps/backend/src/controllers/auth.controller.ts:211-222` (login fallback), `:512-522` (changePassword)
- Test: `apps/backend/test/utils/passwordCheck.test.ts`, `apps/backend/test/controllers/auth.password.test.ts`, `apps/backend/test/static/noAdminSignIn.test.ts`

**Interfaces:**
- Consumes: `createSupabaseMock`, `mockReq`, `mockRes` (Task 1).
- Produces: `verifySupabasePassword(email: string, password: string): Promise<boolean>` in `src/utils/passwordCheck.ts`. Task 3 uses it.

- [ ] **Step 1: Write the failing tests**

```ts
// test/utils/passwordCheck.test.ts — vi.mock('@supabase/supabase-js') so createClient returns { auth: { signInWithPassword } }
it('uses a fresh anon-key client per call, never the service key', async () => {
  signIn.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
  await verifySupabasePassword('a@b.co', 'pw1')
  await verifySupabasePassword('a@b.co', 'pw2')
  expect(createClient).toHaveBeenCalledTimes(2)
  for (const call of createClient.mock.calls) {
    expect(call[1]).toBe('anon-test-key')
    expect(call[2].auth).toMatchObject({ persistSession: false, autoRefreshToken: false })
  }
})
it('returns false on error or missing user', async () => {
  signIn.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } })
  expect(await verifySupabasePassword('a@b.co', 'x')).toBe(false)
})

// test/controllers/auth.password.test.ts — mock ../../src/config/supabase with createSupabaseMock().client
// and ../../src/utils/passwordCheck with vi.fn
it('login with a stale mirror verifies through verifySupabasePassword, not supabaseAdmin', async () => {
  sb.queue('users', { data: { id: 'u-1', email: 'a@b.co', role: 'user', plan: 'free', password_hash: '!' }, error: null })
  verify.mockResolvedValue(true)
  await login(mockReq({ body: { email: 'A@b.co ', password: 'pw' } }), r.res)
  expect(verify).toHaveBeenCalledWith('a@b.co', 'pw')
  expect(sb.client.auth.signInWithPassword).not.toHaveBeenCalled()
  expect(r.statusCode()).toBe(200)
})
it('login returns 401 when the fallback check fails', /* verify → false, expect 401 'Invalid email or password' */)
it('changePassword verifies the current password through verifySupabasePassword', /* expect verify('a@b.co', current), admin signIn not called, 200 */)
it('changePassword returns 401 on a wrong current password and never calls updateUserById', /* … */)

// test/static/noAdminSignIn.test.ts
it('no source file signs a user in on the service-role client', () => {
  const offenders = walk('src').filter((f) =>
    /supabaseAdmin\.auth\.(signInWith\w+|signUp|verifyOtp|setSession|exchangeCodeForSession)\b/.test(readFileSync(f, 'utf8')))
  expect(offenders).toEqual([])
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @safeapply/backend test`
Expected: FAIL. `passwordCheck` cannot be resolved, and the static test lists `src/controllers/auth.controller.ts`.

- [ ] **Step 3: Implement `verifySupabasePassword`**

Each call runs `createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })`, then `signInWithPassword({ email, password })`. It returns `!error && !!data.user`. The client is a local variable and is discarded. Add a header comment explaining why the shared admin client must never sign in (F1).

- [ ] **Step 4: Swap both call sites in `auth.controller.ts`**

Login step 2 becomes `if (!(await verifySupabasePassword(normalizedEmail, password)))` and returns 401 with the same copy. Leave the self-heal step unchanged. changePassword uses `verifySupabasePassword(email, current_password)`. Update the file-header comment, which says "Supabase Auth signInWithPassword".

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @safeapply/backend test && pnpm --filter @safeapply/backend build`
Expected: all passed, and `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/utils/passwordCheck.ts apps/backend/src/controllers/auth.controller.ts apps/backend/test
git commit -m "fix(auth): verify passwords on a throwaway client so the service-role client never holds a user session"
```

Ops note for the PR description: restart every running backend instance after deploy. A poisoned in-memory session survives until the process restarts.

---

### Task 3 (F2, High): Re-authenticate before account deletion

**Files:**
- Modify: `apps/backend/src/validators/auth.validator.ts:124-129`
- Modify: `apps/backend/src/controllers/auth.controller.ts:594-613`
- Modify: `apps/frontend/src/api/auth.ts:85-86`
- Modify: `apps/frontend/src/pages/dashboard/Settings.tsx:149-163, 271-296`
- Test: `apps/backend/test/controllers/auth.delete.test.ts`

**Interfaces:**
- Consumes: `verifySupabasePassword(email, password): Promise<boolean>` (Task 2).
- Produces: `DELETE /api/auth/me` body `{ confirm: 'DELETE', password: string }`. Frontend: `deleteAccount(confirm: 'DELETE', password: string)`.

- [ ] **Step 1: Write the failing tests**

```ts
it('deleteAccountSchema requires a password', () => {
  expect(deleteAccountSchema.validate({ confirm: 'DELETE' }).error).toBeDefined()
  expect(deleteAccountSchema.validate({ confirm: 'DELETE', password: 'pw' }).error).toBeUndefined()
})
it('wrong password → 401 and the user is not deleted', async () => {
  verify.mockResolvedValue(false)
  await deleteAccount(mockReq({ body: { confirm: 'DELETE', password: 'nope' } }), r.res)
  expect(r.statusCode()).toBe(401)
  expect(r.body().error).toBe('Password is incorrect')
  expect(sb.client.auth.admin.deleteUser).not.toHaveBeenCalled()
})
it('right password → deleteUser(userId) and 200', async () => {
  verify.mockResolvedValue(true)
  await deleteAccount(mockReq({ body: { confirm: 'DELETE', password: 'pw' } }), r.res)
  expect(verify).toHaveBeenCalledWith('a@b.co', 'pw')
  expect(sb.client.auth.admin.deleteUser).toHaveBeenCalledWith('u-1')
  expect(r.statusCode()).toBe(200)
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @safeapply/backend test -- auth.delete`
Expected: FAIL. The schema accepts a body without a password, and deleteUser is called on the wrong-password path.

- [ ] **Step 3: Implement the backend change**

In the schema, add `password: Joi.string().max(128).required().messages({ 'any.required': 'Enter your password to confirm' })`. In the controller, run `verifySupabasePassword(req.user!.email, req.body.password)` before `deleteUser`. On false, send `sendError(res, 'Password is incorrect', 401)`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @safeapply/backend test`
Expected: all passed.

- [ ] **Step 5: Update the frontend**

`deleteAccount(confirm, password)` sends `{ confirm, password }`. In Settings, add a `password` state and a `<Field label="Your password" type="password" autoComplete="current-password">` under the DELETE field. Disable "Delete forever" until `confirmText === 'DELETE' && password`. Clear both fields when the modal closes.

Run: `pnpm --filter @safeapply/frontend build`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/validators/auth.validator.ts apps/backend/src/controllers/auth.controller.ts apps/backend/test apps/frontend/src/api/auth.ts apps/frontend/src/pages/dashboard/Settings.tsx
git commit -m "fix(auth): require the account password to delete an account"
```

---

### Task 4 (F3, Medium): Per-account login limit across IPs

**Files:**
- Modify: `apps/backend/src/middleware/rateLimiter.ts:36-42`
- Modify: `apps/backend/src/routes/auth.ts:45`
- Test: `apps/backend/test/middleware/loginLimiter.test.ts`

**Interfaces:**
- Produces: `loginEmailKey(req: Request): string`, which returns `` `email:${email.toLowerCase().trim().slice(0, 254)}` ``. Also `loginEmailLimiter`: 1 hour window, limit 30, `skipSuccessfulRequests: true`, copy `'Too many login attempts for this account. Try again in an hour.'`, keyed by `loginEmailKey`.

- [ ] **Step 1: Write the failing tests**

```ts
it('loginEmailKey ignores IP, case and whitespace', () => {
  const a = loginEmailKey(mockReq({ ip: '1.1.1.1', body: { email: 'Victim@X.com ' } }))
  const b = loginEmailKey(mockReq({ ip: '9.9.9.9', body: { email: 'victim@x.com' } }))
  expect(a).toBe(b)
})
// Mini app: express().set('trust proxy', 1).use(express.json()).post('/l', loginEmailLimiter, (_q, s) => s.status(401).end())
it('31st failed attempt for one email from rotating IPs → 429', async () => {
  for (let i = 0; i < 30; i++)
    await request(app).post('/l').set('X-Forwarded-For', `10.0.${i}.1`).send({ email: 'v@x.com' }).expect(401)
  await request(app).post('/l').set('X-Forwarded-For', '10.9.9.9').send({ email: 'v@x.com' }).expect(429)
})
it('a flood on one email does not block another email', async () => {
  /* after the loop above */ await request(app).post('/l').send({ email: 'other@x.com' }).expect(401)
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @safeapply/backend test -- loginLimiter`
Expected: FAIL, because `loginEmailKey` is not exported.

- [ ] **Step 3: Implement the limiter and mount it**

Add `loginEmailKey` and `loginEmailLimiter` beside `loginAccountLimiter`. In `routes/auth.ts`, the login chain becomes `authLimiter, validate(loginSchema), loginAccountLimiter, loginEmailLimiter, login`. It sits after `validate` so the email has been validated before it becomes a key.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @safeapply/backend test`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/middleware/rateLimiter.ts apps/backend/src/routes/auth.ts apps/backend/test
git commit -m "fix(auth): cap failed logins per account across all IPs"
```

---

### Task 5 (F4, Medium): Reject DOCX decompression bombs before parsing

**Files:**
- Create: `apps/backend/src/utils/zipGuard.ts`
- Modify: `apps/backend/src/middleware/upload.ts:46-63` (`verifyUpload`)
- Test: `apps/backend/test/utils/zipGuard.test.ts`, `apps/backend/test/middleware/upload.test.ts`

**Interfaces:**
- Produces: `zipWithinLimits(buf: Buffer, limits?: { maxEntries?: number; maxTotalBytes?: number }): boolean`. Defaults: `maxEntries` 1000, `maxTotalBytes` 40 MB (`40 * 1024 * 1024`).

- [ ] **Step 1: Write the failing tests (build fixtures with `jszip`)**

```ts
it('accepts a small normal docx-shaped zip', async () => {
  expect(zipWithinLimits(await zip({ 'word/document.xml': '<w:document/>', '[Content_Types].xml': '<Types/>' }))).toBe(true)
})
it('accepts a 10 MB incompressible entry', async () => {
  expect(zipWithinLimits(await zip({ 'word/media/a.png': randomBytes(10 * 1024 * 1024) }))).toBe(true)
})
it('rejects an entry that inflates past 40 MB', async () => {
  expect(zipWithinLimits(await zip({ 'word/document.xml': Buffer.alloc(50 * 1024 * 1024) }, 'DEFLATE'))).toBe(false)
})
it('rejects more than 1000 entries', async () => { /* 1001 one-byte files → false */ })
it('rejects a truncated archive', async () => { /* first half of a valid zip → false */ })
it('measures real inflated size, not the declared size', async () => {
  /* patch the central-directory uncompressed-size field of a bomb to 100 → still false */
})

// upload.test.ts
it('verifyUpload rejects a DOCX bomb with UPLOAD_REJECTED', async () => {
  const next = vi.fn()
  verifyUpload(mockReq({ file: { mimetype: DOCX, buffer: bomb } as any }), {} as any, next)
  expect(next.mock.calls[0][0].code).toBe('UPLOAD_REJECTED')
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @safeapply/backend test -- zipGuard upload`
Expected: FAIL, because `zipGuard` cannot be resolved.

- [ ] **Step 3: Implement `zipWithinLimits`**

Use Node `zlib` only. Return `false` on any out-of-bounds read: wrap the whole function in try/catch.

1. Find the EOCD signature `0x06054b50`, scanning backwards from `buf.length - 22` for up to 65,557 bytes. Read the total entry count (offset +10, u16) and the central-directory offset (+16, u32). If the count is `0xFFFF` or the offset is `0xFFFFFFFF` (ZIP64), reject. If the count exceeds `maxEntries`, reject.
2. Walk the central-directory headers (signature `0x02014b50`, 46 bytes fixed). Read `method` (+10), `compSize` (+20), name length (+28), extra length (+30), comment length (+32) and local-header offset (+42).
3. For each entry, check the local header signature `0x04034b50`. The data starts at `off + 30 + nameLen(+26) + extraLen(+28)`.
4. Method 0: add `compSize` to the total. Method 8: `inflateRawSync(slice, { maxOutputLength: remaining + 1 })`; if it throws or the output exceeds `remaining`, reject. Any other method: reject.
5. Once the total exceeds `maxTotalBytes`, reject. Otherwise return `true`.

- [ ] **Step 4: Call it from `verifyUpload`**

After the `isDocx` check: `if (isDocx && !zipWithinLimits(b)) return next(rejection('That Word file is too big to read once unpacked. Save it again or upload a PDF.'))`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @safeapply/backend test && pnpm --filter @safeapply/backend build`
Expected: all passed, and `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/utils/zipGuard.ts apps/backend/src/middleware/upload.ts apps/backend/test
git commit -m "fix(upload): reject DOCX files that inflate past 40 MB or 1000 entries"
```

---

### Task 6 (F5, Low): UUID-check tracker ids

**Files:**
- Modify: `apps/backend/src/controllers/tracker.controller.ts` (`getApplication`, `updateApplication`, `deleteApplication`, `addCommunication`)
- Test: `apps/backend/test/controllers/tracker.ids.test.ts`

**Interfaces:**
- Consumes: `uuidParam(raw: unknown): string | null` from `src/utils/sanitize.ts`.

- [ ] **Step 1: Write the failing test**

```ts
it.each(['getApplication', 'updateApplication', 'deleteApplication', 'addCommunication'])(
  '%s returns 404 for a non-UUID id without querying the DB', async (name) => {
    await (tracker as any)[name](mockReq({ params: { id: "1' or 1=1" }, body: {} }), r.res)
    expect(r.statusCode()).toBe(404)
    expect(sb.calls).toEqual([])
  })
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @safeapply/backend test -- tracker.ids`
Expected: FAIL. `sb.calls` is non-empty, or the status is not 404.

- [ ] **Step 3: Implement**

In each of the four handlers, replace `const { id } = req.params` with `const id = uuidParam(req.params.id)`. When it is null, return that handler's existing not-found response with status 404.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @safeapply/backend test`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/controllers/tracker.controller.ts apps/backend/test
git commit -m "fix(tracker): 404 on malformed application ids before touching the DB"
```

---

### Task 7 (F6, Medium): Patch vulnerable dependencies

**Files:**
- Modify: `pnpm-workspace.yaml` (add `overrides:`)
- Modify: `apps/backend/package.json` (replace `ts-node-dev` with `tsx`; dev script becomes `tsx watch src/index.ts`)
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Record the baseline**

Run: `pnpm audit --prod --json | jq '.metadata.vulnerabilities'`
Expected: `moderate: 2` (ip-address).

- [ ] **Step 2: Add the overrides and swap the dev runner**

```yaml
overrides:
  ip-address: ">=10.7.1"
  brace-expansion@1: "^1.1.21"
  brace-expansion@5: "^5.0.12"
```

Remove `ts-node-dev` and add `tsx@^4` as a backend devDependency. Then run `pnpm install`.

- [ ] **Step 3: Verify**

Run: `pnpm audit --json | jq '.metadata.vulnerabilities'`
Expected: every count is 0.

Run: `pnpm --filter @safeapply/backend test && pnpm --filter @safeapply/backend build && pnpm --filter @safeapply/frontend build`
Expected: all exit 0.

Run `pnpm --filter @safeapply/backend dev` and `curl -s localhost:$PORT/health`.
Expected: `{"ok":true}`.

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml apps/backend/package.json pnpm-lock.yaml
git commit -m "chore(deps): override vulnerable ip-address/brace-expansion, replace ts-node-dev with tsx"
```
