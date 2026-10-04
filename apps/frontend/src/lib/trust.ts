// FILE: src/lib/trust.ts
// PURPOSE: Names and rules for trust levels and badges. Mirrors the SQL in
//          supabase/008_trust.sql (refresh_trust). Shown on /levels.

export const LEVELS = [
  { n: 0, name: 'New', icon: 'eco' },
  { n: 1, name: 'Verified', icon: 'verified' },
  { n: 2, name: 'Reliable', icon: 'shield' },
  { n: 3, name: 'Proven', icon: 'workspace_premium' },
  { n: 4, name: 'Trusted', icon: 'diamond' },
] as const

export const LEVEL_RULES: Record<'freelancer' | 'client' | 'company', string[]> = {
  freelancer: [
    'Verified: you have a freelancer profile.',
    'Reliable: 3+ approved milestones, at most 1 in 4 handed in after its due date.',
    'Proven: 5+ completed contracts or verified outside work, rating 4.3+, no contracts you quit in 90 days.',
    'Trusted: 15+ completed contracts, rating 4.6+, almost never late, no quits in 90 days.',
  ],
  client: ['Verified: you posted a project.', 'Reliable: 1+ completed contract.', 'Proven: 3+ completed contracts, rating 4.2+ from freelancers.', 'Trusted: 10+ completed contracts, rating 4.5+.'],
  company: [
    'Verified: the company passed verification.',
    'Reliable: opens 70%+ of CVs and replies to 60%+ of applicants within 7 days.',
    'Proven: replies to 70%+ within 7 days and has a verified hire.',
    'Trusted: replies to 85%+, opens 90%+ of CVs, 3+ verified hires.',
    'Any ghost job or ghosting penalty holds a company at Verified.',
  ],
}

export const BADGES: Record<string, { label: string; icon: string; desc: string }> = {
  first_verified_hire: { label: 'First verified hire', icon: 'how_to_reg', desc: 'A person hired through SafeApply confirmed it.' },
  ten_verified_hires: { label: '10 verified hires', icon: 'groups', desc: 'Ten hires confirmed by the people hired.' },
  opens_every_cv: { label: 'Opens every CV', icon: 'visibility', desc: 'Every application opened (10+ applications).' },
  answers_everyone: { label: 'Answers everyone', icon: 'mark_chat_read', desc: 'Nobody left unanswered (10+ applications).' },
  first_contract: { label: 'First contract', icon: 'handshake', desc: 'Completed a first contract.' },
  zero_late: { label: 'Never late', icon: 'schedule', desc: '5+ approved milestones, none after the due date.' },
  five_star: { label: 'Five stars', icon: 'star', desc: '3+ reviews, all five stars.' },
  verified_five: { label: '5 verified jobs', icon: 'verified', desc: 'Five pieces of outside work confirmed by clients.' },
  first_hire: { label: 'First hire', icon: 'person_add', desc: 'Hired a first freelancer.' },
  fast_approver: { label: 'Fast approver', icon: 'bolt', desc: 'Approved 5+ milestones within 3 days of hand-in.' },
  repeat_client: { label: 'Repeat client', icon: 'autorenew', desc: 'Hired the same freelancer twice.' },
  first_interview: { label: 'First interview', icon: 'event_available', desc: 'Confirmed a first interview.' },
  hired: { label: 'Hired', icon: 'celebration', desc: 'Confirmed a job offer through SafeApply.' },
  researcher: { label: 'Researcher', icon: 'travel_explore', desc: 'Checked 3+ companies before applying.' },
}
