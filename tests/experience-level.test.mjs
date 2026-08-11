/**
 * experience-level.test.mjs — regression tests for seniority classification
 * and level-aware match scoring.
 *
 * Locks in the fix for two defects that made "Best Matches" show senior and
 * staff roles at the top for a mid-level candidate:
 *   1. `parseExperienceLevel` never saw the job title, so 99% of stored jobs
 *      defaulted to MID — "Staff Frontend Engineer" included.
 *   2. `calculateLevelMatch` compared the resume against the *job's* level
 *      keywords instead of comparing candidate level to job level.
 *
 * Run: npx tsx tests/experience-level.test.mjs
 */

import { classifyExperienceLevel } from '../src/lib/job-providers/experience-level.ts'
import { inferCandidateLevel, batchScoreJobsHeuristic } from '../src/lib/ai-matcher/index.ts'

let passed = 0
let failed = 0

function check(input, expected, note = '') {
  const actual = classifyExperienceLevel(input)
  if (actual === expected) passed++
  else {
    failed++
    console.error(`  FAIL ${JSON.stringify(input)} -> ${actual}, expected ${expected}${note ? ` (${note})` : ''}`)
  }
}

function checkLevel(resume, expected, note = '') {
  const actual = inferCandidateLevel(resume)
  if (actual === expected) passed++
  else {
    failed++
    console.error(`  FAIL inferCandidateLevel(${JSON.stringify(resume.slice(0, 40))}) -> ${actual}, expected ${expected}${note ? ` (${note})` : ''}`)
  }
}

console.log('Titles that used to fall through to MID')
check('Staff Frontend Engineer, Ads Creative', 'STAFF')
check('Senior Software Engineer, Backend', 'SENIOR')
check('Principal Applied AI/ML Scientist', 'STAFF')
check('Sr. Data Engineer', 'SENIOR', 'abbreviated form')
check('Lead Product Designer', 'SENIOR')
check('Director of Engineering', 'STAFF')
check('Head of Platform', 'STAFF')
check('Engineering Manager, Payments', 'SENIOR')
check('Distinguished Engineer', 'STAFF')
check('Senior Staff Engineer', 'STAFF', 'higher of the two wins')

console.log('Genuinely mid and entry roles')
check('Software Engineer', 'MID')
check('Backend Engineer, Privy', 'MID')
check('Frontend Engineer React and AWS', 'MID')
check('Junior Developer', 'ENTRY')
check('Jr. Analyst', 'ENTRY')
check('Software Engineer Intern', 'ENTRY')
check('New Grad Software Engineer', 'ENTRY')
check('Software Engineering Apprentice', 'ENTRY')

console.log('Word boundaries — substrings must not decide')
check('Technical Leadership Program Coordinator', 'MID', '"leadership" is not "lead"')
check('SRE, Platform', 'MID', '"SRE" is not "Sr."')
check('Site Reliability Engineer', 'MID')
check('Customer Success Manager', 'SENIOR', 'manager is genuinely senior-ish')
check('', 'MID', 'empty falls back')
check(undefined, 'MID')

console.log('Candidate level inferred from the resume')
checkLevel('Software engineer with 7 years of experience building APIs', 'SENIOR')
checkLevel('Engineer, 3 years experience with React and Node', 'MID')
checkLevel('Recent graduate seeking entry-level roles', 'ENTRY')
checkLevel('12 years leading platform teams', 'STAFF')
checkLevel('Built REST services in Python. Shipped a data pipeline.', 'MID', 'no cues defaults to MID, not ENTRY')
checkLevel('Senior Software Engineer at Acme', 'SENIOR', 'held title when no years stated')

console.log('Ranking: an over-leveled role must not outrank an exact-level one')
const resume = 'Software engineer. Built REST APIs in Python and React. Shipped features to production with the team on several projects.'
const skills = ['Python', 'React', 'REST']
const baseJob = {
  company: 'Acme',
  description: 'We need someone to build and ship APIs in production with the team on real projects.',
  skills: ['Python', 'React', 'REST'],
  roleType: 'BACKEND',
}
const scores = await batchScoreJobsHeuristic(resume, skills, [
  { ...baseJob, id: 'mid', title: 'Backend Engineer', experienceLevel: 'MID' },
  { ...baseJob, id: 'senior', title: 'Senior Backend Engineer', experienceLevel: 'SENIOR' },
  { ...baseJob, id: 'staff', title: 'Staff Backend Engineer', experienceLevel: 'STAFF' },
])
const mid = scores.get('mid').score
const senior = scores.get('senior').score
const staff = scores.get('staff').score
console.log(`  MID=${mid}  SENIOR=${senior}  STAFF=${staff}`)

if (mid > senior) passed++
else { failed++; console.error(`  FAIL exact-level (${mid}) must beat one-up (${senior})`) }
if (senior > staff) passed++
else { failed++; console.error(`  FAIL one-up (${senior}) must beat two-up (${staff})`) }
if (scores.get('staff').reasoning.includes('well above your level')) passed++
else { failed++; console.error(`  FAIL staff reasoning should name the gap, got: ${scores.get('staff').reasoning}`) }

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
