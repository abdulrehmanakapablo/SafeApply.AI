// FILE: src/lib/accountTypes.ts
// PURPOSE: Copy and routing for the four account types on the auth pages.
//          `role` is what the backend stores; `variant` picks the AuthShell aside.

export type AccountType = 'user' | 'recruiter' | 'freelancer' | 'client'

export const ACCOUNT: Record<AccountType, { label: string; variant: 'seeker' | 'recruiter' | 'freelancer' | 'client'; signupTitle: string; signupSub: string; loginTitle: string; loginSub: string; afterSignup: string; portal: string }> = {
  user: {
    label: 'Job seeker',
    variant: 'seeker',
    signupTitle: 'Create your account',
    signupSub: 'Free during early access. No card needed.',
    loginTitle: 'Welcome back',
    loginSub: 'Log in to your reports, CVs and applications.',
    afterSignup: '/dashboard',
    portal: '/dashboard',
  },
  recruiter: {
    label: 'Recruiter',
    variant: 'recruiter',
    signupTitle: 'Hire on SafeApply',
    signupSub: 'Post verified jobs with real salaries. Free during early access.',
    loginTitle: 'Recruiter login',
    loginSub: 'Log in to your jobs, applicants and messages.',
    afterSignup: '/recruiter/company',
    portal: '/recruiter',
  },
  freelancer: {
    label: 'Freelancer',
    variant: 'freelancer',
    signupTitle: 'Find freelance work',
    signupSub: 'Clear budgets, agreed milestones, reviews both ways.',
    loginTitle: 'Freelancer login',
    loginSub: 'Log in to your proposals and contracts.',
    afterSignup: '/freelancer/profile',
    portal: '/freelancer',
  },
  client: {
    label: 'Client',
    variant: 'client',
    signupTitle: 'Hire a freelancer',
    signupSub: 'Post a project with a budget and compare proposals.',
    loginTitle: 'Client login',
    loginSub: 'Log in to your projects and contracts.',
    afterSignup: '/client/projects/new',
    portal: '/client',
  },
}

export const ACCOUNT_TYPES = Object.keys(ACCOUNT) as AccountType[]
export const parseAccountType = (v: string | null): AccountType => (v && v in ACCOUNT ? (v as AccountType) : 'user')
