import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/jobs/billing.jobs', () => ({ billingTasks: [] }))
vi.mock('../../src/jobs/accountability.jobs', () => ({ accountabilityTasks: [] }))
vi.mock('../../src/jobs/interviews.jobs', () => ({ interviewTasks: [] }))
vi.mock('../../src/jobs/trust.jobs', () => ({ trustTasks: [] }))

import { registerTasks, runDueTasks } from '../../src/jobs/scheduler'

const MIN = 60_000
const ran: string[] = []
registerTasks([
  { name: 'every30', everyMs: 30 * MIN, run: async () => void ran.push('every30') },
  { name: 'every6h', everyMs: 360 * MIN, run: async () => void ran.push('every6h') },
  { name: 'broken', everyMs: 30 * MIN, run: async () => { throw new Error('boom') } },
])

describe('runDueTasks', () => {
  it('runs a task only in the first beat of its period', async () => {
    ran.length = 0
    await runDueTasks(15 * MIN, false, 30 * MIN * 1000 + 5 * MIN) // 5 min into a 30-min slot
    expect(ran).toEqual(['every30'])
    ran.length = 0
    await runDueTasks(15 * MIN, false, 30 * MIN * 1000 + 20 * MIN) // 20 min in: not due
    expect(ran).toEqual([])
  })
  it('runs everything with all=true and reports failures without stopping', async () => {
    ran.length = 0
    const out = await runDueTasks(15 * MIN, true, 7 * MIN)
    expect(ran).toEqual(['every30', 'every6h'])
    expect(out.find((r) => r.name === 'broken')).toMatchObject({ ok: false, error: 'boom' })
  })
})
