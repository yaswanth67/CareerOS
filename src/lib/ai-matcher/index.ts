import Anthropic from '@anthropic-ai/sdk'
import { MatchResult } from '@/types'

// Initialize Anthropic client only if an API key/token is available.
// ANTHROPIC_AUTH_TOKEN is used when talking to a local Claude Code connection
// (e.g. claude-code-router); ANTHROPIC_API_KEY is the direct Anthropic fallback.
const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

let anthropic: Anthropic | null = null

if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
  })
}

const MATCHING_PROMPT = `You are an expert technical recruiter and career coach. Analyze how well a candidate's resume matches a job description.

CANDIDATE RESUME:
{resume}

JOB DESCRIPTION:
Title: {jobTitle}
Company: {company}
Description: {description}
Required Skills: {skills}
Experience Level: {experienceLevel}
Role Type: {roleType}

Provide a detailed match analysis in this exact JSON format:
{
  "score": <number 0-100>,
  "reasoning": "<2-3 sentences explaining the score>",
  "matchedSkills": ["skill1", "skill2", ...],
  "missingSkills": ["skill1", "skill2", ...],
  "recommendation": "STRONG_MATCH|GOOD_MATCH|WEAK_MATCH|NO_MATCH"
}

Scoring guidelines:
- 80-100: Strong match - candidate has most required skills and relevant experience
- 60-79: Good match - candidate has many required skills, some gaps but trainable
- 40-59: Weak match - significant skill gaps, may need substantial upskilling
- 0-39: Poor match - fundamental mismatch in role, skills, or experience level

Consider:
1. Technical skill overlap (weight: 40%)
2. Experience relevance (weight: 30%)
3. Role type alignment (weight: 20%)
4. Experience level match (weight: 10%)

Be honest and specific. If the candidate lacks critical required skills, score accordingly.`

export async function scoreJobAgainstResume(
  resumeText: string,
  resumeSkills: string[],
  job: {
    title: string
    company: string
    description: string
    skills: string[]
    experienceLevel: string
    roleType: string
  }
): Promise<MatchResult> {
  // Try Anthropic if available
  if (anthropic) {
    try {
      return await scoreWithAnthropic(resumeText, resumeSkills, job)
    } catch (error) {
      console.warn('Anthropic scoring failed, using fallback:', error)
    }
  }

  // Fallback to heuristic scoring (works without any API)
  return heuristicScore(resumeText, resumeSkills, job)
}

async function scoreWithAnthropic(
  resumeText: string,
  resumeSkills: string[],
  job: {
    title: string
    company: string
    description: string
    skills: string[]
    experienceLevel: string
    roleType: string
  }
): Promise<MatchResult> {
  const prompt = MATCHING_PROMPT
    .replace('{resume}', resumeText.slice(0, 8000))
    .replace('{jobTitle}', job.title)
    .replace('{company}', job.company)
    .replace('{description}', job.description.slice(0, 3000))
    .replace('{skills}', job.skills.join(', '))
    .replace('{experienceLevel}', job.experienceLevel)
    .replace('{roleType}', job.roleType)

  const response = await anthropic!.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  })

  // Local Claude proxies may prepend a "thinking" block, so find the text block.
  const textBlock = response.content.find(block => block.type === 'text')
  if (!textBlock) {
    throw new Error('Unexpected response type')
  }

  const result = JSON.parse(textBlock.text)

  // Validate and clamp score
  result.score = Math.max(0, Math.min(100, Math.round(result.score)))
  result.recommendation = result.recommendation || getRecommendation(result.score)

  return result
}

/**
 * Heuristic scoring - works completely offline without any AI API
 * Uses multi-factor analysis: skills, experience, role type, level
 */
function heuristicScore(
  resumeText: string,
  resumeSkills: string[],
  job: {
    title: string
    company: string
    description: string
    skills: string[]
    experienceLevel: string
    roleType: string
  }
): MatchResult {
  const resumeSkillSet = new Set(resumeSkills.map(s => s.toLowerCase()))
  const resumeTextLower = resumeText.toLowerCase()
  const jobDescLower = job.description.toLowerCase()

  // 1. Skill Overlap (40% weight)
  const matchedSkills = job.skills.filter(s => resumeSkillSet.has(s.toLowerCase()))
  const missingSkills = job.skills.filter(s => !resumeSkillSet.has(s.toLowerCase()))
  const skillScore = job.skills.length > 0
    ? (matchedSkills.length / job.skills.length) * 100
    : 50

  // 2. Experience Relevance (30% weight)
  const experienceKeywords = [
    'year', 'experience', 'worked', 'built', 'developed', 'designed',
    'implemented', 'led', 'managed', 'architected', 'deployed',
    'production', 'scale', 'team', 'project', 'delivered'
  ]
  const experienceMatches = experienceKeywords.filter(kw =>
    resumeTextLower.includes(kw) && jobDescLower.includes(kw)
  ).length
  const experienceScore = Math.min(100, (experienceMatches / experienceKeywords.length) * 150)

  // 3. Role Type Alignment (20% weight)
  const roleTypeScore = calculateRoleAlignment(resumeTextLower, job.roleType)

  // 4. Experience Level Match (15% weight)
  const levelScore = calculateLevelMatch(resumeTextLower, job.experienceLevel)

  // Weighted composite. Level carries 15% (was 10%), taken from the experience
  // keyword overlap, which is the softest of the four signals — it counts
  // generic words like "team" and "project" appearing in both documents.
  const weighted =
    skillScore * 0.40 +
    experienceScore * 0.25 +
    roleTypeScore * 0.20 +
    levelScore * 0.15

  // Then scale down anything above the candidate's level, so an out-of-reach
  // posting cannot outrank a comparable one they could actually get.
  const finalScore = Math.round(weighted * levelReachPenalty(resumeTextLower, job.experienceLevel))

  // Generate reasoning
  const reasoning = generateReasoning(
    matchedSkills.length,
    job.skills.length,
    job.roleType,
    roleTypeScore,
    job.experienceLevel,
    levelScore
  )

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    reasoning,
    matchedSkills,
    missingSkills,
    recommendation: getRecommendation(finalScore),
  }
}

function calculateRoleAlignment(resumeText: string, jobRoleType: string): number {
  const roleKeywords: Record<string, string[]> = {
    AI_ENGINEER: ['machine learning', 'ml', 'ai', 'deep learning', 'neural', 'pytorch', 'tensorflow', 'transformers', 'llm', 'langchain'],
    DATA_SCIENTIST: ['data science', 'analytics', 'statistics', 'modeling', 'pandas', 'numpy', 'scikit', 'visualization'],
    DATA_ENGINEER: ['data engineering', 'etl', 'pipeline', 'spark', 'kafka', 'airflow', 'warehouse', 'dbt'],
    DEVOPS: ['devops', 'infrastructure', 'kubernetes', 'docker', 'terraform', 'ci/cd', 'aws', 'gcp', 'azure'],
    FRONTEND: ['frontend', 'react', 'vue', 'angular', 'ui', 'ux', 'css', 'html', 'typescript', 'next.js'],
    BACKEND: ['backend', 'api', 'server', 'database', 'sql', 'node.js', 'python', 'go', 'java', 'microservice'],
    FULLSTACK: ['fullstack', 'full stack', 'end-to-end', 'frontend', 'backend', 'database', 'api'],
    MOBILE: ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
    SECURITY: ['security', 'penetration', 'vulnerability', 'auth', 'encryption', 'compliance'],
    PM: ['product', 'roadmap', 'stakeholder', 'agile', 'scrum', 'user research', 'metrics'],
  }

  const keywords = roleKeywords[jobRoleType] || []
  if (keywords.length === 0) return 50

  const matches = keywords.filter(kw => resumeText.includes(kw.toLowerCase())).length
  return Math.min(100, (matches / keywords.length) * 120)
}

/** Seniority ladder, low to high. Index doubles as the level's rank. */
const LEVEL_ORDER = ['ENTRY', 'MID', 'SENIOR', 'STAFF'] as const

/**
 * The candidate's own level, read from their resume.
 *
 * Years of experience win when the resume states them, since that is the thing
 * postings actually gate on. Otherwise a held title ("Senior Engineer") is the
 * next best signal. A resume that says neither is treated as MID rather than
 * ENTRY: guessing low would bury every mid-level role, and guessing high would
 * reintroduce exactly the problem this scoring exists to prevent.
 */
export function inferCandidateLevel(resumeText: string): (typeof LEVEL_ORDER)[number] {
  const text = resumeText.toLowerCase()

  const years = [...text.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/g)]
    .map(m => parseInt(m[1], 10))
    .filter(n => Number.isFinite(n) && n <= 40)
  const maxYears = years.length ? Math.max(...years) : null

  if (maxYears !== null) {
    if (maxYears >= 10) return 'STAFF'
    if (maxYears >= 5) return 'SENIOR'
    if (maxYears >= 2) return 'MID'
    return 'ENTRY'
  }

  if (/\b(staff|principal|distinguished|fellow|head of|director|vp)\b/.test(text)) return 'STAFF'
  if (/\b(senior|sr\.?)\b/.test(text) || /\blead\b/.test(text)) return 'SENIOR'
  if (/\b(intern|internship|junior|jr\.?|new grad|graduate|entry[- ]?level)\b/.test(text)) {
    return 'ENTRY'
  }

  return 'MID'
}

/**
 * How well a posting's seniority suits the candidate, 0–100.
 *
 * This used to check whether the *resume* contained the *job level's* own
 * keywords — so a senior posting scored well for anyone whose resume happened
 * to say "lead" or "mentor", and the candidate's actual level was never
 * considered at all. Now it compares the two levels directly.
 *
 * Reaching one level up is a stretch worth showing; two or more up is a role
 * the candidate will not be considered for. Roles below the candidate stay
 * respectable — they can do the work — but rank under an exact fit.
 */
function calculateLevelMatch(resumeText: string, jobLevel: string): number {
  const candidate = inferCandidateLevel(resumeText)
  const jobIndex = LEVEL_ORDER.indexOf(jobLevel as (typeof LEVEL_ORDER)[number])
  if (jobIndex === -1) return 50

  const distance = jobIndex - LEVEL_ORDER.indexOf(candidate)
  if (distance === 0) return 100
  if (distance === 1) return 55
  if (distance >= 2) return 10
  if (distance === -1) return 70
  return 45
}

/**
 * Multiplier applied to the composite score for a posting above the
 * candidate's level.
 *
 * Weighting alone is not enough: level is one term among four, so a staff role
 * with strong skill overlap still outscored an exact-level role with slightly
 * weaker overlap — which is how a junior candidate's "best matches" filled up
 * with Staff and Senior titles. Scaling the whole score keeps an over-leveled
 * posting visible while making it lose to a comparable role at the right level.
 */
function levelReachPenalty(resumeText: string, jobLevel: string): number {
  const jobIndex = LEVEL_ORDER.indexOf(jobLevel as (typeof LEVEL_ORDER)[number])
  if (jobIndex === -1) return 1
  const distance = jobIndex - LEVEL_ORDER.indexOf(inferCandidateLevel(resumeText))
  if (distance <= 0) return 1
  if (distance === 1) return 0.9
  if (distance === 2) return 0.75
  return 0.6
}

function generateReasoning(
  matchedCount: number,
  totalSkills: number,
  roleType: string,
  roleScore: number,
  expLevel: string,
  levelScore: number
): string {
  const skillPct = totalSkills > 0 ? Math.round((matchedCount / totalSkills) * 100) : 0
  const roleLabel = roleType.replace(/_/g, ' ')
  const levelLabel = expLevel

  let reasoning = `Skill match: ${matchedCount}/${totalSkills} (${skillPct}%) required skills. `
  reasoning += `Role alignment with ${roleLabel}: ${roleScore > 60 ? 'strong' : roleScore > 30 ? 'moderate' : 'weak'}. `

  // Name the seniority gap explicitly — it now moves the ranking, so the card
  // should say why an otherwise strong match sits lower.
  if (levelScore >= 100) reasoning += `Seniority (${levelLabel}): matches your level.`
  else if (levelScore >= 70) reasoning += `Seniority (${levelLabel}): below your level.`
  else if (levelScore >= 55) reasoning += `Seniority (${levelLabel}): one level up — a stretch.`
  else if (levelScore <= 10) reasoning += `Seniority (${levelLabel}): well above your level.`
  else reasoning += `Seniority (${levelLabel}): partial match.`

  return reasoning
}

function getRecommendation(score: number): MatchResult['recommendation'] {
  if (score >= 80) return 'STRONG_MATCH'
  if (score >= 60) return 'GOOD_MATCH'
  if (score >= 40) return 'WEAK_MATCH'
  return 'NO_MATCH'
}

export async function batchScoreJobs(
  resumeText: string,
  resumeSkills: string[],
  jobs: Array<{
    id: string
    title: string
    company: string
    description: string
    skills: string[]
    experienceLevel: string
    roleType: string
  }>
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>()

  // Process in batches of 5 to avoid rate limits (if using Anthropic)
  const batchSize = anthropic ? 5 : 20 // Larger batches for heuristic
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (job) => {
        const result = await scoreJobAgainstResume(resumeText, resumeSkills, job)
        results.set(job.id, result)
      })
    )
  }

  return results
}

/**
 * Bulk heuristic scoring — fast and free (no API calls). Used for automatic
 * scoring when jobs are fetched, so every active job gets a match score without
 * hitting the LLM for thousands of jobs.
 */
export async function batchScoreJobsHeuristic(
  resumeText: string,
  resumeSkills: string[],
  jobs: Array<{
    id: string
    title: string
    company: string
    description: string
    skills: string[]
    experienceLevel: string
    roleType: string
  }>
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>()
  for (const job of jobs) {
    results.set(job.id, heuristicScore(resumeText, resumeSkills, job))
  }
  return results
}