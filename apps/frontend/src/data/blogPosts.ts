// FILE: src/data/blogPosts.ts
// All blog content - append a new object to BLOG_POSTS to publish a new post.
// Content format: markdown-lite. Blank line = new paragraph.
//   ## Heading          → H2
//   ### Heading         → H3
//   - item              → bullet
//   1. item             → numbered
//   > quote             → blockquote
//   **bold** / *italic* → inline emphasis

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  date: string // ISO date
  author: string
  readTime: number // minutes
  tags: string[]
  content: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-to-research-a-company-before-applying',
    title: 'How to research a company before applying (a 15-minute method)',
    excerpt:
      'A systematic checklist you can run in 15 minutes: funding, news, engineering activity, review patterns, and ghost-posting signals - using only free public sources.',
    date: '2025-01-15',
    author: 'SafeApply Team',
    readTime: 8,
    tags: ['Research', 'Job Search'],
    content: `
Most candidates spend more time formatting their resume than researching the company they are about to spend two years of their life at. That is backwards.

The good news: a proper company check takes about 15 minutes if you know what to look for. This is the exact method we use to build SafeApply.AI reports - you can run it manually.

## Minute 0-3: Check the money

Follow the money first. Companies that just raised are hiring aggressively and safer than companies that just lost funding.

- Search "[company] funding" - open the last two rounds. Note the round size and date.
- Look for the last funding date. **If it has been more than 24 months since the last round and they are not profitable, that is a yellow flag.**
- Check the investors. Tier-1 VC-backed companies have more pressure and more runway.

If the company is public, check the last earnings call transcript - anything from the last 90 days.

## Minute 3-7: Read the news window

Filter for the last 90 days only. Older news is noise.

- Google News search: "[company] layoffs OR acquisition OR leadership" - sort by date.
- LinkedIn posts from the last 30 days by employees.
- Founder or CEO posts on X - anything that reads defensive is worth noting.

**Red flags:** sudden executive departures, quiet layoffs disguised as "restructuring," deferred funding rounds, or a CEO who has stopped posting.

## Minute 7-10: Check the engineering signal

Skip this if it is not a tech company. If it is:

- GitHub org - public repos, last commit date, languages used.
- Compare GitHub languages to the tech stack the job description claims. Mismatches are common.
- Check their engineering blog. If the last post is 3 years old, ask what happened.

**Green flag:** active repos updated in the last 30 days.
**Red flag:** public repos that stopped getting commits 6+ months ago, or a claimed "Rust" stack with only Python repos.

## Minute 10-13: Read the reviews

Go to Glassdoor and sort by "most recent." Ignore anything older than a year.

Read for patterns, not individual complaints:

- **Repeated phrases** across multiple reviews - "micromanagement," "great WLB," "constant re-orgs" - these are real.
- **Sudden rating drops** over the last 12 months.
- **Response patterns** from the company - do they respond to negative reviews? Do they sound defensive?

One angry ex-employee is noise. Five ex-employees saying the same thing in six months is data.

## Minute 13-15: Ghost-posting check

Search: "[company name]" "[job title]" on Google, sorted by date. Look at:

- How many times has this specific role been posted in the last 12 months?
- Is it posted across LinkedIn, Indeed, Glassdoor, and their own careers page - or just one?
- Do the postings have identical text?

**A role that has been reposted 3+ times in a year with the same description is very likely a ghost posting** - kept open for pipeline purposes, EB-1/H1B wage proofing, or investor signaling.

## What to do with the picture

You now have a stack of citations. Every check above produces a link. Copy them into a note.

**Do not decide in the moment.** Sleep on it. Then ask: does this company pass your own bar, not a "score"? The score is not the point. You are.

## Where SafeApply.AI fits

Every step in this checklist is exactly what runs inside a SafeApply.AI report. News from the last 90 days, GitHub activity, ghost-posting signals, review aggregates - all in one screen, all cited, with source links next to each data point.

You still make the call. We just remove the tab-hoarding.
`.trim(),
  },

  {
    slug: 'ats-resume-formatting-rules-2025',
    title: 'ATS resume formatting rules that actually matter in 2025',
    excerpt:
      'Most ATS advice online is from 2015. Here is what Workday, Greenhouse, Lever, and modern parsers actually choke on - and the formatting rules that survive.',
    date: '2025-01-08',
    author: 'SafeApply Team',
    readTime: 9,
    tags: ['CV & ATS', 'Resume'],
    content: `
Search "ATS resume" and you get a wall of advice from 2015 - avoid columns, avoid colors, use a specific font, never include a photo. Some of that is still true. Most of it is not.

Here is what modern ATS systems actually parse in 2025, based on how Workday, Greenhouse, and Lever ingest resumes today.

## What actually breaks an ATS parser

Modern parsers are dramatically better than their 2015 versions. They handle simple columns, most fonts, and basic graphics. The things that still break them are specific:

- **Multi-column layouts with mismatched section flows.** Two columns are fine. Two columns where the reading order is ambiguous are not.
- **Headers and footers.** Anything in the Word/PDF header or footer is often stripped entirely.
- **Text in images.** A logo with text baked in is invisible.
- **Tables used for layout.** Parsers read them as data, not structure.
- **Custom section names.** "Where I Have Been" is not a section. "Experience" is.
- **PDFs exported from Canva or Figma.** Frequently produce garbage text objects.

## Formatting rules that actually matter

**Use standard section headers.**
Experience. Education. Skills. Projects. Certifications. Anything else risks being dropped.

**One column is safest. Two columns are fine if each column is self-contained.**
Left column: dates and titles. Right column: descriptions. Never the reverse - parsers read top-to-bottom, left-to-right.

**Font: use a standard one.**
Helvetica, Arial, Calibri, Inter, Times New Roman, Georgia. Avoid display fonts, handwritten fonts, or anything with ligatures.

**Font size: 10-12pt for body, 14-18pt for name.**
Smaller than 10pt starts getting dropped by some parsers. Larger than 12pt wastes space.

**Dates: use one format consistently.**
"Jan 2023 - Present" or "01/2023 - Present" - pick one and never mix. Parsers often fail when dates are inconsistent across the document.

**Contact info at the top, in the body, not in a text box.**
Name, email, phone, LinkedIn. Location is optional but useful.

**No headers, footers, or page numbers.**
They get stripped. If your resume is 2 pages, the reader will figure it out.

**Save as PDF unless told otherwise.**
PDF preserves formatting across machines. Only submit DOCX if the employer explicitly asks.

## The keyword myth

"Stuff keywords" is bad advice. Modern parsers do keyword matching, but the recruiter reads the resume too. Keyword stuffing reads worse than a clean resume.

What actually works:

- **Match the job title where honest.** If the JD says "Senior Backend Engineer" and your title at your last company was "Software Engineer III," use "Software Engineer III (Senior Backend)" - if that is accurate.
- **Use the exact technology names from the JD.** If the JD says "PostgreSQL" and your resume says "Postgres," use "PostgreSQL."
- **Mirror seniority language.** If the JD says "led," "owned," "drove" - use those verbs.

## The ATS score is not the goal

Some tools give you an "ATS score." Ignore it as a target. The score is an approximation. The real goal is: **can a recruiter find your relevant experience in 6 seconds?**

If yes, the ATS will too.

## Quick test

Run your resume through our CV Match tool. It shows you:

- The keyword mismatches between your CV and the JD (JD says "TypeScript," CV says "TS").
- The skills missing from your CV that the JD asks for.
- ATS-specific warnings - multi-column issues, unparseable sections, etc.

It is not a score. It is a list of specific things to fix.
`.trim(),
  },

  {
    slug: 'how-to-detect-ghost-job-postings',
    title: 'How to detect a ghost job posting in under 5 minutes',
    excerpt:
      'Ghost jobs waste weeks of candidate time. Here is how to spot them using only public search data - no tools, no accounts, no subscriptions.',
    date: '2025-01-02',
    author: 'SafeApply Team',
    readTime: 6,
    tags: ['Ghost Jobs', 'Job Search'],
    content: `
A ghost job is a posting that is not actively being filled. Companies post them for a handful of reasons, none of them good for you:

- Pipeline building (they want to know who is out there)
- Investor signaling ("look how many open roles we have")
- H1B wage proofing (US-specific, requires public posting of the role)
- Internal candidate already lined up but HR requires a public search

Estimates vary, but surveys consistently find 20-40% of public postings never result in a hire.

Here is how to spot them.

## Method 1 - Repost frequency

Google search:

\`"CompanyName" "JobTitle" site:linkedin.com OR site:indeed.com OR site:glassdoor.com\`

Sort results by date. Look at how many times the **same role with the same description** appears.

- **Posted once, less than 30 days ago:** normal.
- **Posted 2 times, 60+ days apart:** worth checking.
- **Posted 3+ times over 6+ months with identical text:** very likely a ghost posting.

## Method 2 - Description quality

Real postings have specific requirements. Ghost postings often have one of two tells:

**Too vague:**
"Looking for a passionate engineer to join our fast-paced team. Experience with modern technologies required."

**Too perfect:**
A copy-pasted JD with obviously mismatched company details (mentions a stack the company does not actually use, references a benefits package that does not match the careers page).

## Method 3 - The application flow

Apply for the job. Then watch what happens:

- **Auto-rejection within 24 hours:** the ATS filtered you out, but it also means an active filter is running - probably a real role.
- **Total silence for 3+ weeks:** could go either way, but common with ghost roles.
- **Instant "we received your application" then nothing:** often indicates a pipeline posting.

## Method 4 - Cross-reference

Check the company's own careers page. Some companies repost ghost roles on aggregators but never on their own page - that is a tell.

Check the role's listed location against any recent office closures or layoffs. A "San Francisco" role at a company that just announced SF office closures is a ghost.

## What to do when you find one

Do not apply. Spend the time on a real opening instead.

If you have already applied: it is not wasted. Add it to your tracker, mark it, move on. The pattern recognition you gain is worth something.

## Where SafeApply.AI helps

Our Ghost Posting Detection runs the exact same search - sorted by date, filtered to job-relevant platforms - and shows you the posting timeline in one view.

No more copy-pasting search strings. Just paste the company name and job title.
`.trim(),
  },

  {
    slug: 'setting-up-a-job-application-tracker',
    title: 'Setting up a job application tracker that you will actually use',
    excerpt:
      'Most trackers fail because they are too complicated or too sparse. Here is the minimum viable tracker - the fields that matter, the ones that do not, and how to review it weekly.',
    date: '2024-12-26',
    author: 'SafeApply Team',
    readTime: 7,
    tags: ['Tracker', 'Productivity'],
    content: `
Job seekers who track their applications get responses faster. Not because tracking changes anything magically - because tracking reveals patterns you cannot see in your head.

Here is how to set one up that you will actually maintain.

## The fields that matter

Every tracker application needs seven things:

1. **Company name**
2. **Role title**
3. **Date applied**
4. **Status** (saved, applied, screening, interviewing, offered, rejected, ghosted)
5. **Source** (LinkedIn, referral, company site, cold outreach)
6. **Match score** (your estimate, or SafeApply's, of how well you fit)
7. **Last action** (what happened most recently, and when)

That is it. Anything beyond these seven is optional.

## Fields that do not matter

- Full job description (unless you are actively preparing for an interview)
- Full company research (put a link, not the notes)
- Long-form notes per application (keep a separate doc if you must)
- Salary expectations (you will not need this until offer stage)

## Kanban vs list

Use **Kanban** if you are actively working 10+ applications. Drag a card from "Applied" to "Screening" the moment you get an email. The visual progress is motivating.

Use **list** if you have fewer than 10 active. It is faster to scan.

Most people should use both - Kanban for active, list for the archive.

## What to track as "actions"

After you apply, the only things worth logging:

- "Recruiter reached out" (date)
- "Screening call scheduled" (date)
- "Interview 1 completed" (date)
- "Rejection received" (date)
- "Followed up via email" (date)

Do not log "told a friend about the role." Do not log "updated my resume." Only log things that moved the application forward or ended it.

## The weekly review

Every Friday, spend 15 minutes:

1. Sort applications by "last action" date. Anything untouched for 10+ days is effectively ghosted - mark it.
2. Count how many applications you sent this week. If it is under 5, ask why.
3. Count how many moved to "Screening." If it is zero for three weeks, your CV needs work - not more applications.
4. Look at your rejections. Are there patterns? Same company? Same type of role? Same stage?

The Friday review is where the tracker pays for itself.

## What it looks like in SafeApply.AI

Our Application Tracker has all of the above - Kanban + list views, seven status columns, per-application notes with autosave, status timelines, communication logs, and a weekly analytics view that shows you response rate, interview rate, and offer rate over time.

No setup. Paste the JD or company name and hit save.
`.trim(),
  },

  {
    slug: 'resume-bullet-rewrites-before-after',
    title: 'Resume bullet rewrites: 12 before-and-after examples',
    excerpt:
      'The fastest resume upgrade is not a new format. It is rewriting weak bullets into strong ones. Twelve real examples with the reasoning behind each fix.',
    date: '2024-12-18',
    author: 'SafeApply Team',
    readTime: 10,
    tags: ['Resume', 'CV & ATS'],
    content: `
Most bullets on most resumes are descriptions of the job, not evidence of the work. Rewriting them is the highest-leverage 30 minutes you can spend on your resume.

Here are 12 real examples, with the reasoning behind each rewrite.

## 1. The passive verb

**Before:** Responsible for managing the backend team's migration from MongoDB to PostgreSQL.
**After:** Led a 6-person backend team's migration from MongoDB to PostgreSQL, cutting query latency by 40%.

**Why:** "Responsible for" is a filler. "Led" says what you did. Adding one number ("6-person") and one outcome ("40%") makes it a real bullet.

## 2. The feature list

**Before:** Worked on features including authentication, search, billing, and admin dashboard.
**After:** Shipped authentication, billing, and search features used by 50,000+ daily active users.

**Why:** "Worked on" is soft. "Shipped" is concrete. Dropping the admin dashboard is fine - one strong list beats four weak ones.

## 3. The unclear scope

**Before:** Improved the company website.
**After:** Redesigned the marketing site, increasing signup conversion from 2.1% to 3.4% over 90 days.

**Why:** "Improved" is meaningless. "Redesigned" + specific metric + specific timeframe = evidence.

## 4. The team-padding bullet

**Before:** Collaborated with cross-functional teams to deliver projects on time.
**After:** Partnered with design and PM to ship the checkout redesign, which added $1.2M in annualized revenue.

**Why:** "Cross-functional" is filler. Name the functions. Name the project. Name the outcome.

## 5. The process-heavy bullet

**Before:** Participated in agile ceremonies and contributed to sprint planning.
**After:** Introduced story-point estimation, reducing average sprint spillover from 30% to 8%.

**Why:** Nobody cares that you attended stand-up. Tell them what you changed about how the team worked.

## 6. The vague seniority claim

**Before:** Senior engineer with 8 years of experience.
**After:** Senior engineer - 8 years across payments and infrastructure, including 3 years leading teams of 4-8.

**Why:** The number alone is filler. The domain and the team-leadership detail is what makes "senior" mean something.

## 7. The "helped" bullet

**Before:** Helped build the internal analytics platform.
**After:** Built the internal analytics platform serving 200+ internal users and reducing report turnaround from 4 days to 2 hours.

**Why:** "Helped" downgrades you. If you built it, say so. If you did not, say exactly what you did.

## 8. The toolkit dump

**Before:** Experience with React, TypeScript, Node.js, PostgreSQL, Redis, Docker, Kubernetes, AWS, and CI/CD.
**After:** Shipped three production React + TypeScript apps on AWS, handling 10M+ daily requests.

**Why:** Listing tools is table stakes. Showing what you built with them is what the reader wants.

## 9. The responsibility copy

**Before:** Managed the deployment pipeline and ensured zero-downtime releases.
**After:** Rebuilt the CI/CD pipeline using GitHub Actions, dropping deploy time from 22 minutes to 4 and eliminating all 3am rollbacks in Q3.

**Why:** The original is a JD, not evidence. The rewrite gives the reader: what changed, what the numbers are, what the impact was.

## 10. The invisible project

**Before:** Worked on various projects as needed by the team.
**After:** Built a customer-facing refund flow that processed $4M in transactions in its first quarter.

**Why:** "Various projects" tells the reader nothing. Pick the biggest project and own it.

## 11. The soft-skill bullet

**Before:** Strong communication and stakeholder management skills.
**After:** Presented quarterly roadmap reviews to the VP of Product and 3 engineering managers, aligning on scope across 12 initiatives.

**Why:** Claims of soft skills are worthless. Evidence of soft skills - presenting to specific stakeholders - is not.

## 12. The jargon wall

**Before:** Leveraged synergies to drive alignment and enable cross-functional outcomes at scale.
**After:** Standardized the release process across 4 teams, cutting time-to-production from 3 weeks to 4 days.

**Why:** Nobody has ever been hired because of "synergies." Replace jargon with a specific change and a specific outcome.

## The pattern

Every strong bullet has three parts:

1. **A concrete verb** (led, built, shipped, redesigned, migrated)
2. **A specific scope** (team size, user count, dollar amount, timeframe)
3. **A measurable outcome** (percent, dollars, seconds, users)

If your bullet is missing any of the three, it is weak. If it is missing all three, delete it.

## Where SafeApply.AI fits

Our CV Match tool rewrites weak bullets automatically, using the language of the specific job description you are targeting. You accept or reject each suggestion individually, then export the updated CV.

Not a score. A list of edits.
`.trim(),
  },

  {
    slug: 'how-to-read-company-reviews',
    title: 'How to read company reviews without getting fooled',
    excerpt:
      'Glassdoor, Blind, Indeed - every review platform has biases. Here is how to weigh the signals, spot planted reviews, and extract the truth from the noise.',
    date: '2024-12-10',
    author: 'SafeApply Team',
    readTime: 7,
    tags: ['Reviews', 'Research'],
    content: `
Reviews are the single most useful signal in a job search - and the single easiest to be fooled by.

The trick is not to read more reviews. It is to read them differently.

## What reviews are actually measuring

Every review is one person's 12-18 month experience, filtered through the mood they were in when they wrote it. That makes them noisy individually and useful in aggregate.

The question is never "is this review true?" - it is "is this pattern real?"

## The signals that matter

**Recency-weighted patterns.**
A company with 4.2 stars overall but 3.1 stars over the last 6 months has changed. Weight recent reviews 3x more than older ones.

**Repeated phrases.**
If 5 different reviewers say "constant re-orgs" in the last year, it is real. If one reviewer says it and everyone else says "great WLB," it is not.

**Response patterns from the company.**
Some companies respond to every negative review - usually defensive, rarely useful. Companies that never respond are indifferent. The interesting ones are companies that respond thoughtfully or not at all.

**Role-type consistency.**
Reviews from engineers at a company might be wildly different from reviews from sales. Read reviews from your role type first.

## The signals to ignore

**The 1-star review that reads like a rant.**
Real complaints are specific. "Terrible place, avoid" is noise. "On-call was unprotected and my manager refused to escalate" is data.

**The 5-star review from "Anonymous, no role given."**
Planted reviews often have this shape - generic praise, no role, no specifics.

**Ratings alone.**
A 4.6 average means nothing without reading the pattern. It could be 50 five-star reviews and 5 one-star reviews - the 5 might tell you everything.

**The "CEO is great" reviews.**
Usually written by leadership or HR. Not useful.

## How to spot planted reviews

Common patterns:

- Posted in a cluster on the same date
- All 5-star, all vague, all from "Anonymous"
- Written in a style that reads like corporate communications
- No specific project or team mentioned
- Every review on the same week
- No criticism whatsoever (real reviews always have at least one gripe)

You do not need to prove a review is planted. You just need to notice that the cluster is unnatural and exclude it from your read.

## What to do when sources disagree

Glassdoor says 4.5. Blind says 3.0. Reddit says "avoid." Which do you trust?

Reddit is the most honest (no filtering, no employer curation, brutal). Glassdoor is the most filtered (companies can flag reviews, ask for removal). Blind is somewhere in between.

Weight them roughly like this:

- **Reddit:** 1.0 - unfiltered, but tiny sample
- **Blind:** 0.8 - verified employees, but skewed tech
- **Glassdoor:** 0.6 - large sample, but filtered
- **Indeed:** 0.5 - often noisy, mixed quality
- **Company's own "life at" page:** 0.2 - marketing

When they disagree, trust the most negative signal. The reason: negative reviews are harder to fake than positive ones. It is easier to plant 10 five-star reviews than to plant 10 one-star reviews.

## The relationship label matters

Every credible review system should tell you the reviewer's relationship to the company:

- **Current employee** - usually most balanced, but may be cautious
- **Former employee** - often most candid, sometimes bitter
- **Applicant** - useful for interview process, less for culture
- **Knows someone** - useful as a signal but weakest category

A "former employee" review is worth more than an "applicant" review about culture. An "applicant" review is worth more than a "former employee" review about interview process.

## What SafeApply.AI does

Our anonymous review system is designed for this. Reviewers specify their relationship, reviews are moderated for authenticity, and the listing never exposes reviewer identity. No fake five-stars, no curation.

We aggregate patterns across reviews so you see the noise cleaned up, not the raw feed.
`.trim(),
  },
]