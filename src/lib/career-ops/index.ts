import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { persistCareerOpsReport } from './persist'

// Runs career-ops' Claude evaluation pipeline — the same one the tool drives
// inside Claude Code — but through the app's existing Claude connection
// (ANTHROPIC_BASE_URL, the local Claude Code proxy the app already uses for its
// AI features), so no separate Gemini key is needed. The evaluation methodology
// is read live from the career-ops workspace (modes/_shared.md + modes/oferta.md
// + cv.md + profile), keeping the scoring faithful to the real tool.
//
// Requires: career-ops installed (npx @santifer/career-ops init) and the Claude
// connection the app already configures via ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY.

const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

let anthropic: Anthropic | null = null

if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
    // Fail fast (5 min) if the local Claude proxy is down instead of hanging
    // for the SDK default (10 min) — a dead connection should never look like
    // an infinite spinner in the UI. The proxy is slow (~110 output tokens/sec),
    // so keep this well above the UI's 240s client timeout.
    timeout: 300_000,
  })
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
// Roomy budget so a long A–G report isn't truncated before the machine-readable
// SCORE_SUMMARY block at the end (an 8192 cap cut off the summary on real runs).
const MAX_TOKENS = 16000
const TEMPERATURE = 0.4 // deterministic enough for structured evaluation

export interface CareerOpsJob {
  /** Stable job id, when the job came from the Dashboard. Omitted for pasted/URL jobs. */
  id?: string
  title: string
  company: string
  description: string
  /** Posting URL — when present, the report is saved to the career-ops workspace. */
  applyUrl?: string
}

export interface CareerOpsResume {
  title: string
  parsedText: string
}

export interface CareerOpsCandidate {
  name?: string | null
  email?: string | null
}

export interface CareerOpsReport {
  score: number | null
  company: string
  role: string
  archetype: string
  legitimacy: string
  markdown: string
  /** Absolute path the report was saved to in the career-ops workspace, if any. */
  reportPath?: string | null
  /** Allocated career-ops report number, if the report was saved. */
  reportNumber?: number | null
}

/** Absolute path to the career-ops workspace (env override or ./career-ops). */
export function careerOpsDir(): string {
  return process.env.CAREER_OPS_DIR || path.join(process.cwd(), 'career-ops')
}

/** Whether the integration is usable right now (Claude connection + workspace). */
export function isCareerOpsReady(): { ok: boolean; error?: string } {
  if (!anthropic) {
    return { ok: false, error: 'Claude connection is not configured — set ANTHROPIC_AUTH_TOKEN (or ANTHROPIC_API_KEY) in .env.' }
  }
  for (const rel of ['modes/_shared.md', 'modes/oferta.md']) {
    if (!existsSync(path.join(careerOpsDir(), rel))) {
      return { ok: false, error: 'career-ops is not installed — run `npx @santifer/career-ops init` from the project root' }
    }
  }
  return { ok: true }
}

/** Read a workspace file, degrading gracefully if missing (like gemini-eval.mjs). */
function readWorkspaceFile(rel: string): string {
  const filePath = path.join(careerOpsDir(), rel)
  if (!existsSync(filePath)) return `[${rel} not found — skipping]`
  return readFileSync(filePath, 'utf-8').trim()
}

/** Seed a minimal config/profile.yml so the language directive can be parsed. */
async function ensureProfileYml(candidate: CareerOpsCandidate): Promise<void> {
  const profilePath = path.join(careerOpsDir(), 'config', 'profile.yml')
  if (existsSync(profilePath)) return // preserve any existing career-ops profile

  const fullName = candidate.name || 'MatchIQ user'
  // JSON.stringify produces a safe double-quoted YAML string.
  const profile = [
    'candidate:',
    `  full_name: ${JSON.stringify(fullName)}`,
    candidate.email ? `  email: ${JSON.stringify(candidate.email)}` : '',
    'language:',
    '  output: en',
    'spend_tier: standard',
  ]
    .filter(Boolean)
    .join('\n')

  await mkdir(path.dirname(profilePath), { recursive: true })
  await writeFile(profilePath, `${profile}\n`, 'utf-8')
}

/** Write cv.md from the app's resume (the app is the source of truth for CVs). */
async function writeCv(resume: CareerOpsResume): Promise<void> {
  const body = resume.parsedText?.trim()
  if (!body) {
    throw new Error('Resume has no parsed text to evaluate against — upload a resume first.')
  }
  const content = resume.title ? `# ${resume.title}\n\n${body}\n` : `${body}\n`
  await writeFile(path.join(careerOpsDir(), 'cv.md'), content, 'utf-8')
}

/** Build career-ops' system prompt from its real mode files + the user's CV. */
function buildSystemPrompt(resume: CareerOpsResume): string {
  const shared = readWorkspaceFile('modes/_shared.md')
  const oferta = readWorkspaceFile('modes/oferta.md')
  const profile = readWorkspaceFile('modes/_profile.md')
  const profileYml = readWorkspaceFile('config/profile.yml')
  const cv = `# ${resume.title}\n\n${resume.parsedText.trim()}`

  const contextBody = [
    '## Shared context',
    shared,
    '## Evaluation methodology',
    oferta,
    '## Your CV',
    cv,
    '## Profile',
    profile,
    '## Profile config',
    profileYml,
  ].join('\n\n')

  return `You are career-ops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.

Your evaluation methodology is defined below. Follow it exactly.

${contextBody}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Block D (Comp research): provide salary estimates based on your training data, clearly noted as estimates.
   - For Block G (Legitimacy): analyze the JD text only; skip URL/page freshness checks.
2. Write all human-facing output in English, including the full A-G evaluation and the machine-readable summary's free-text fields, regardless of the language of the job description.
3. Generate Blocks A through G in full.
4. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---`
}

/** Reject malformed reports (same shape checks as career-ops' gemini-eval.mjs). */
function assertValidReport(text: string): void {
  const issues: string[] = []
  const requiredBlocks: [string, RegExp][] = [
    ['A', /(?:^|\n)#{1,3}\s*(?:A[).:-]?|Block A\b)/im],
    ['B', /(?:^|\n)#{1,3}\s*(?:B[).:-]?|Block B\b)/im],
    ['C', /(?:^|\n)#{1,3}\s*(?:C[).:-]?|Block C\b)/im],
    ['D', /(?:^|\n)#{1,3}\s*(?:D[).:-]?|Block D\b)/im],
    ['E', /(?:^|\n)#{1,3}\s*(?:E[).:-]?|Block E\b)/im],
    ['F', /(?:^|\n)#{1,3}\s*(?:F[).:-]?|Block F\b)/im],
    ['G', /(?:^|\n)#{1,3}\s*(?:G[).:-]?|Block G\b)/im],
  ]

  for (const [label, pattern] of requiredBlocks) {
    if (!pattern.test(text)) issues.push(`missing Block ${label}`)
  }

  const summary = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/)
  if (!summary) {
    issues.push('missing SCORE_SUMMARY block')
  } else {
    const block = summary[1]
    for (const key of ['COMPANY', 'ROLE', 'ARCHETYPE', 'LEGITIMACY']) {
      const field = block.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'mi'))
      const value = field?.[1]?.trim() ?? ''
      if (!value || (key !== 'COMPANY' && value.toLowerCase() === 'unknown')) {
        issues.push(`SCORE_SUMMARY ${key} is required`)
      }
    }
    const score = block.match(/^\s*SCORE:\s*([0-9]+(?:\.[0-9]+)?)/mi)
    const scoreValue = score ? Number(score[1]) : NaN
    if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 5) {
      issues.push('SCORE_SUMMARY score must be a number between 0 and 5')
    }
  }

  if (issues.length > 0) {
    throw new Error(`career-ops returned an invalid report: ${issues.join('; ')}`)
  }
}

interface SummaryFields {
  score: number | null
  company: string
  role: string
  archetype: string
  legitimacy: string
}

function extractSummary(text: string): SummaryFields {
  const summary = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/)

  const extract = (key: string): string => {
    if (summary) {
      const prefix = `${key}:`
      const line = summary[1].split('\n').find((l) => l.trimStart().startsWith(prefix))
      if (line) return line.trimStart().slice(prefix.length).trim()
    }
    return ''
  }

  const scoreNum = Number(extract('SCORE'))
  return {
    score: Number.isFinite(scoreNum) ? scoreNum : null,
    company: extract('COMPANY'),
    role: extract('ROLE'),
    archetype: extract('ARCHETYPE'),
    legitimacy: extract('LEGITIMACY'),
  }
}

/** The report body = the model text minus the machine-readable summary block. */
function extractMarkdown(text: string): string {
  let markdown = text.replace(/---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---/g, '').trim()
  // Strip a code-fence wrapper if the model wrapped the report in one.
  if (markdown.startsWith('```') && markdown.endsWith('```')) {
    markdown = markdown.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
  }
  return markdown
}

/**
 * Evaluate a job against a resume using career-ops' Claude pipeline, driven
 * through the app's existing Claude connection. Returns the parsed 1–5 score,
 * archetype, legitimacy, and the full A–G report markdown.
 */
export interface CoverLetterOptions {
  /** Tone: 'formal' | 'direct' | 'conversational' | 'mirror' */
  tone?: 'formal' | 'direct' | 'conversational' | 'mirror'
  /** User's answer to "Why this role / company?" */
  whyThisRole?: string
  /** User's answer to "What problem would you solve?" */
  problemToSolve?: string
  /** User's answer to "How would you approach it?" */
  approach?: string
  /** User's responses to gap detection prompts */
  gapResponses?: Record<string, string>
}

export interface CoverLetterResult {
  /** The generated cover letter markdown */
  markdown: string
  /** Extracted keywords from JD for reference */
  keywords?: { atsCritical: string[]; languageSignals: string[] }
  /** Detected gaps that were addressed */
  gapsAddressed?: string[]
  /** Word count of the letter body */
  wordCount?: number
}

/** Generate a tailored cover letter using career-ops cover mode methodology. */
export async function runCoverLetter(args: {
  job: CareerOpsJob
  resume: CareerOpsResume
  candidate?: CareerOpsCandidate
  options?: CoverLetterOptions
}): Promise<CoverLetterResult> {
  const { job, resume, candidate = {}, options = {} } = args

  const ready = isCareerOpsReady()
  if (!ready.ok) throw new Error(ready.error)

  const jd = job.description?.trim()
  if (!jd) {
    throw new Error('This job has no description to write a cover letter for.')
  }
  if (!anthropic) {
    throw new Error('Claude connection is not configured.')
  }

  await writeCv(resume)
  await ensureProfileYml(candidate)

  // Build system prompt from career-ops cover mode
  const shared = readWorkspaceFile('modes/_shared.md')
  const cover = readWorkspaceFile('modes/cover.md')
  const writing = readWorkspaceFile('modes/_writing.md')
  const profileMd = readWorkspaceFile('modes/_profile.md')
  const profileYml = readWorkspaceFile('config/profile.yml')
  const cv = `# ${resume.title}\n\n${resume.parsedText.trim()}`

  const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You generate tailored cover letters from a job description and the user's CV.

Your cover letter methodology is defined below. Follow it exactly.

## Shared context
${shared}

## Cover letter methodology
${cover}

## Writing guidance
${writing}

## Your CV
${cv}

## Profile
${profileMd}

## Profile config
${profileYml}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Step 3 (Company research): provide a research summary based on your training data, clearly noted as estimates. Ask the user to confirm or add to it.
   - For Step 4 (Keywords): extract from the JD provided.
2. Write all human-facing output in English, including the full cover letter.
3. Follow ALL steps in the cover.md mode — do not skip steps.
4. At the very end, output the final cover letter in a machine-readable block:

---COVER_LETTER---
<full cover letter markdown>
---END_COVER_LETTER---

Also output metadata:
---COVER_META---
KEYWORDS_ATS: <comma-separated>
KEYWORDS_SIGNALS: <comma-separated>
GAPS_ADDRESSED: <comma-separated>
WORD_COUNT: <number>
---END_COVER_META---`

  // Build user content with the JD and any user-provided answers
  let userContent = `JOB DESCRIPTION TO WRITE COVER LETTER FOR:\n\n${jd}\n\n`

  if (options.tone) {
    userContent += `User-selected tone: ${options.tone}\n`
  }
  if (options.whyThisRole) {
    userContent += `User's answer to "Why this role/company?": ${options.whyThisRole}\n`
  }
  if (options.problemToSolve) {
    userContent += `User's answer to "What problem would you solve?": ${options.problemToSolve}\n`
  }
  if (options.approach) {
    userContent += `User's answer to "How would you approach it?": ${options.approach}\n`
  }
  if (options.gapResponses && Object.keys(options.gapResponses).length > 0) {
    userContent += `User's gap responses:\n`
    for (const [gap, response] of Object.entries(options.gapResponses)) {
      userContent += `  ${gap}: ${response}\n`
    }
  }

  userContent += `\nFollow the cover.md mode exactly. Execute all steps. Do not generate the letter until all mandatory steps (research, keywords, gaps, four prompts) are complete. For steps requiring user input (research confirmation, keyword confirmation, gap responses, four prompts), use the provided answers above. If an answer is not provided, note it and proceed with a reasonable default but flag it in the output.`

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
    raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude cover letter generation failed: ${message}`)
  }

  if (!raw) {
    throw new Error('Claude returned an empty cover letter.')
  }

  // Extract cover letter from the response
  const letterMatch = raw.match(/---COVER_LETTER---\s*([\s\S]*?)---END_COVER_LETTER---/)
  const metaMatch = raw.match(/---COVER_META---\s*([\s\S]*?)---END_COVER_META---/)

  const markdown = letterMatch ? letterMatch[1].trim() : raw

  let keywords: { atsCritical: string[]; languageSignals: string[] } | undefined
  let gapsAddressed: string[] | undefined
  let wordCount: number | undefined

  if (metaMatch) {
    const meta = metaMatch[1]
    const extract = (key: string): string => {
      const line = meta.split('\n').find((l) => l.trimStart().startsWith(`${key}:`))
      return line ? line.trimStart().slice(key.length + 1).trim() : ''
    }
    const ats = extract('KEYWORDS_ATS')
    const signals = extract('KEYWORDS_SIGNALS')
    const gaps = extract('GAPS_ADDRESSED')
    const wc = extract('WORD_COUNT')
    if (ats || signals) {
      keywords = {
        atsCritical: ats ? ats.split(',').map(s => s.trim()).filter(Boolean) : [],
        languageSignals: signals ? signals.split(',').map(s => s.trim()).filter(Boolean) : [],
      }
    }
    if (gaps) {
      gapsAddressed = gaps.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (wc) {
      wordCount = parseInt(wc, 10) || undefined
    }
  }

  return { markdown, keywords, gapsAddressed, wordCount }
}

export interface TailoredResumeOptions {
  /** Target role title if it differs from the JD's listed title */
  targetRole?: string
}

export interface TailoredResumeResult {
  /** The tailored resume markdown */
  markdown: string
  /** Keywords extracted from the JD that were woven into the CV */
  keywords?: string[]
  /** JD requirements the CV cannot cover — surfaced as gaps, never invented */
  gaps?: string[]
}

/** Tailor the user's CV against a job description using career-ops pdf mode methodology. */
export async function runTailoredResume(args: {
  job: CareerOpsJob
  resume: CareerOpsResume
  candidate?: CareerOpsCandidate
  options?: TailoredResumeOptions
}): Promise<TailoredResumeResult> {
  const { job, resume, candidate = {}, options = {} } = args

  const ready = isCareerOpsReady()
  if (!ready.ok) throw new Error(ready.error)

  const jd = job.description?.trim()
  if (!jd) {
    throw new Error('This job has no description to tailor a resume against.')
  }
  if (!anthropic) {
    throw new Error('Claude connection is not configured.')
  }

  await writeCv(resume)
  await ensureProfileYml(candidate)

  // Build system prompt from career-ops pdf mode (the tailored-CV methodology)
  const shared = readWorkspaceFile('modes/_shared.md')
  const pdf = readWorkspaceFile('modes/pdf.md')
  const writing = readWorkspaceFile('modes/_writing.md')
  const profileMd = readWorkspaceFile('modes/_profile.md')
  const profileYml = readWorkspaceFile('config/profile.yml')
  const cv = `# ${resume.title}\n\n${resume.parsedText.trim()}`

  const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You tailor the user's CV to a specific job description, following the career-ops PDF/CV methodology.

Your CV tailoring methodology is defined below. Follow it exactly.

## Shared context
${shared}

## CV tailoring methodology
${pdf}

## Writing guidance
${writing}

## Your CV (source of truth)
${cv}

## Profile
${profileMd}

## Profile config
${profileYml}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools. Use the JD provided.
2. Write all human-facing output in English.
3. Never fabricate experience, projects, metrics, or credentials that are not present in the user's CV. Reorder, reformulate and emphasise — never invent. If the CV lacks a skill or requirement the JD demands, list it in GAPS instead of claiming it.
4. Follow the pdf mode methodology: extract 15-20 keywords from the JD, run the skill-gap check against the CV, tailor the professional summary, reorder and rephrase bullet points to lead with the most relevant experience, and weave the keywords in naturally.
5. At the very end, output the tailored resume in a machine-readable block:

---TAILORED_RESUME---
<full tailored resume markdown>
---END_TAILORED_RESUME---

Also output metadata:
---RESUME_META---
KEYWORDS: <comma-separated>
GAPS: <comma-separated>
---END_RESUME_META---`

  let userContent = `JOB DESCRIPTION TO TAILOR THE CV FOR:\n\n${jd}\n\n`
  if (options.targetRole) {
    userContent += `Target role title: ${options.targetRole}\n`
  }
  userContent += `\nFollow the pdf mode exactly. Tailor the CV above to this job. Do not invent any fact, project, metric, or credential that is not in the CV.`

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
    raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude resume tailoring failed: ${message}`)
  }

  if (!raw) {
    throw new Error('Claude returned an empty tailored resume.')
  }

  const resumeMatch = raw.match(/---TAILORED_RESUME---\s*([\s\S]*?)---END_TAILORED_RESUME---/)
  const metaMatch = raw.match(/---RESUME_META---\s*([\s\S]*?)---END_RESUME_META---/)

  const markdown = resumeMatch ? resumeMatch[1].trim() : raw

  let keywords: string[] | undefined
  let gaps: string[] | undefined
  if (metaMatch) {
    const meta = metaMatch[1]
    const extract = (key: string): string => {
      const line = meta.split('\n').find((l) => l.trimStart().startsWith(`${key}:`))
      return line ? line.trimStart().slice(key.length + 1).trim() : ''
    }
    const kw = extract('KEYWORDS')
    if (kw) {
      keywords = kw.split(',').map((s) => s.trim()).filter(Boolean)
    }
    const gp = extract('GAPS')
    if (gp) {
      gaps = gp.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }

  return { markdown, keywords, gaps }
}

export interface InterviewPrepOptions {
  /** Optional coffee chat notes for this company */
  coffeeChatNotes?: string
  /** Prior stated compensation from tracker */
  priorStatedComp?: string
}

export interface InterviewPrepResult {
  /** The generated interview prep markdown */
  markdown: string
  /** Process overview extracted from research */
  processOverview?: string
  /** Audience map for each round */
  audienceMap?: string
  /** Panel intel table */
  panelIntel?: string
}

/** Generate company-specific interview prep using career-ops interview-prep mode methodology. */
export async function runInterviewPrep(args: {
  job: CareerOpsJob
  resume: CareerOpsResume
  candidate?: CareerOpsCandidate
  options?: InterviewPrepOptions
}): Promise<InterviewPrepResult> {
  const { job, resume, candidate = {}, options = {} } = args

  const ready = isCareerOpsReady()
  if (!ready.ok) throw new Error(ready.error)

  const jd = job.description?.trim()
  if (!jd) {
    throw new Error('This job has no description for interview prep.')
  }
  if (!anthropic) {
    throw new Error('Claude connection is not configured.')
  }

  await writeCv(resume)
  await ensureProfileYml(candidate)

  // Build system prompt from career-ops interview-prep mode
  const shared = readWorkspaceFile('modes/_shared.md')
  const interviewPrep = readWorkspaceFile('modes/interview-prep.md')
  const profileMd = readWorkspaceFile('modes/_profile.md')
  const profileYml = readWorkspaceFile('config/profile.yml')
  const cv = `# ${resume.title}\n\n${resume.parsedText.trim()}`

  const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You generate company-specific interview intelligence from a job description and the user's CV.

Your interview prep methodology is defined below. Follow it exactly.

## Shared context
${shared}

## Interview prep methodology
${interviewPrep}

## Your CV
${cv}

## Profile
${profileMd}

## Profile config
${profileYml}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Step 1 (Research): provide research summaries based on your training data, clearly noted as estimates. Note when data is sparse.
2. Write all human-facing output in English.
3. Follow ALL steps in the interview-prep.md mode — do not skip steps.
4. At the very end, output the full interview prep in a machine-readable block:

---INTERVIEW_PREP---
<full interview prep markdown>
---END_INTERVIEW_PREP---

Also output metadata:
---PREP_META---
PROCESS_OVERVIEW: <extracted or "unknown">
AUDIENCE_MAP: <extracted or "unknown">
PANEL_INTEL: <extracted or "unknown">
---END_PREP_META---`

  // Build user content with the JD and any user-provided context
  let userContent = `JOB DESCRIPTION FOR INTERVIEW PREP:\n\n${jd}\n\n`

  if (options.coffeeChatNotes) {
    userContent += `Coffee chat notes for ${job.company}:\n${options.coffeeChatNotes}\n\n`
  }
  if (options.priorStatedComp) {
    userContent += `Prior stated compensation: ${options.priorStatedComp}\n\n`
  }

  userContent += `Follow the interview-prep.md mode exactly. Execute all steps. For Step 1 (Research), provide estimates from training data and note when data is sparse. For Step 2 (Process Overview), extract what you can. For Step 4 (Panel Intel), note when specific interviewers aren't known. Generate the full output.`

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
    raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude interview prep generation failed: ${message}`)
  }

  if (!raw) {
    throw new Error('Claude returned empty interview prep.')
  }

  // Extract interview prep from the response
  const prepMatch = raw.match(/---INTERVIEW_PREP---\s*([\s\S]*?)---END_INTERVIEW_PREP---/)
  const metaMatch = raw.match(/---PREP_META---\s*([\s\S]*?)---END_PREP_META---/)

  const markdown = prepMatch ? prepMatch[1].trim() : raw

  let processOverview: string | undefined
  let audienceMap: string | undefined
  let panelIntel: string | undefined

  if (metaMatch) {
    const meta = metaMatch[1]
    const extract = (key: string): string => {
      const line = meta.split('\n').find((l) => l.trimStart().startsWith(`${key}:`))
      return line ? line.trimStart().slice(key.length + 1).trim() : ''
    }
    processOverview = extract('PROCESS_OVERVIEW') || undefined
    audienceMap = extract('AUDIENCE_MAP') || undefined
    panelIntel = extract('PANEL_INTEL') || undefined
  }

  return { markdown, processOverview, audienceMap, panelIntel }
}

export type EmailVariant = 'hr_application' | 'referral_request' | 'cold_application' | 'process_stuck' | 'confirmed_time_noshow' | 'linkedin_message'

export interface EmailOptions {
  /** Email variant */
  variant?: EmailVariant
  /** Context for process_stuck variant */
  stuckContext?: string
  /** Context for confirmed_time_noshow variant */
  noshowContext?: string
}

export interface EmailResult {
  /** The generated email markdown */
  markdown: string
  /** Subject line */
  subject?: string
  /** Variant used */
  variant: EmailVariant
}

/** Generate an application email using career-ops email mode methodology. */
export async function runApplicationEmail(args: {
  job: CareerOpsJob
  resume: CareerOpsResume
  candidate?: CareerOpsCandidate
  options?: EmailOptions
}): Promise<EmailResult> {
  const { job, resume, candidate = {}, options = {} } = args

  const ready = isCareerOpsReady()
  if (!ready.ok) throw new Error(ready.error)

  const jd = job.description?.trim()
  if (!jd) {
    throw new Error('This job has no description for the email.')
  }
  if (!anthropic) {
    throw new Error('Claude connection is not configured.')
  }

  await writeCv(resume)
  await ensureProfileYml(candidate)

  // Build system prompt from career-ops email mode
  const shared = readWorkspaceFile('modes/_shared.md')
  const emailMode = readWorkspaceFile('modes/email.md')
  const writing = readWorkspaceFile('modes/_writing.md')
  const profileMd = readWorkspaceFile('modes/_profile.md')
  const profileYml = readWorkspaceFile('config/profile.yml')
  const voiceDna = readWorkspaceFile('modes/voice-dna.md')
  const cv = `# ${resume.title}\n\n${resume.parsedText.trim()}`

  const variant = options.variant || 'hr_application'

  const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You generate tailored application email drafts from a job description and the user's CV.

Your email methodology is defined below. Follow it exactly.

## Shared context
${shared}

## Email methodology
${emailMode}

## Writing guidance
${writing}

## Voice DNA
${voiceDna}

## Your CV
${cv}

## Profile
${profileMd}

## Profile config
${profileYml}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
2. Write all human-facing output in English.
3. Follow ALL steps in the email.md mode — do not skip steps.
4. The variant is: ${variant}
5. At the very end, output the final email in a machine-readable block:

---EMAIL---
<full email markdown with subject line>
---END_EMAIL---

Also output metadata:
---EMAIL_META---
VARIANT: ${variant}
SUBJECT: <subject line>
---END_EMAIL_META---`

  // Build user content with the JD and any user-provided context
  let userContent = `JOB DESCRIPTION FOR EMAIL:\n\n${jd}\n\n`

  if (options.stuckContext) {
    userContent += `Process stuck context: ${options.stuckContext}\n\n`
  }
  if (options.noshowContext) {
    userContent += `No-show context: ${options.noshowContext}\n\n`
  }

  userContent += `Follow the email.md mode exactly. Execute all steps for the ${variant} variant. Generate the full email draft.`

  // A LinkedIn message is not a letter — force the shape so the result reads
  // like a first touch in InMail rather than an email with a subject line.
  if (variant === 'linkedin_message') {
    userContent += `\n\nThis is a LinkedIn message, not an email: write in the first person, conversational but professional, no subject line, and keep it under 300 words. Address it as an InMail/connection note to the relevant recruiter or hiring manager.`
  }

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
    raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude email generation failed: ${message}`)
  }

  if (!raw) {
    throw new Error('Claude returned empty email.')
  }

  // Extract email from the response
  const emailMatch = raw.match(/---EMAIL---\s*([\s\S]*?)---END_EMAIL---/)
  const metaMatch = raw.match(/---EMAIL_META---\s*([\s\S]*?)---END_EMAIL_META---/)

  const markdown = emailMatch ? emailMatch[1].trim() : raw

  let subject: string | undefined
  let returnedVariant: EmailVariant = variant

  if (metaMatch) {
    const meta = metaMatch[1]
    const extract = (key: string): string => {
      const line = meta.split('\n').find((l) => l.trimStart().startsWith(`${key}:`))
      return line ? line.trimStart().slice(key.length + 1).trim() : ''
    }
    subject = extract('SUBJECT') || undefined
    const v = extract('VARIANT') as EmailVariant
    if (v) returnedVariant = v
  }

  return { markdown, subject, variant: returnedVariant }
}

export interface UpskillOptions {
  /** Optional single JD URL for targeted analysis instead of aggregate */
  targetedUrl?: string
}

export interface UpskillGap {
  skill: string
  reports: number
  lowFitReports: number
  lowFitShare: number
  weightedScore: number
  tier: 'Critical' | 'High' | 'Medium' | 'Low'
  sources: string[]
}

export interface UpskillResult {
  /** The generated upskill analysis markdown */
  markdown: string
  /** Structured gap data */
  gaps: UpskillGap[]
  /** Skills already known (excluded from gaps) */
  excludedAsKnown: string[]
  /** Known skills extracted from CV/profile */
  knownSkills: string[]
  /** Schema version */
  schemaVersion: number
  /** Metadata about reports analyzed */
  metadata: {
    reportsLinked: number
    reportsRead: number
    reportsWithMachineSummary: number
    reportsScored: number
    lowFitReports: number
  }
  /** Learning plan (if generated) */
  learningPlan?: string
}

/** Generate aggregate skill-gap analysis using career-ops upskill mode methodology. */
export async function runUpskill(args: {
  resume: CareerOpsResume
  candidate?: CareerOpsCandidate
  options?: UpskillOptions
}): Promise<UpskillResult> {
  const { resume, candidate = {}, options = {} } = args

  const ready = isCareerOpsReady()
  if (!ready.ok) throw new Error(ready.error)

  if (!anthropic) {
    throw new Error('Claude connection is not configured.')
  }

  await writeCv(resume)
  await ensureProfileYml(candidate)

  // Build system prompt from career-ops upskill mode
  const shared = readWorkspaceFile('modes/_shared.md')
  const upskillMode = readWorkspaceFile('modes/upskill.md')
  const profileMd = readWorkspaceFile('modes/_profile.md')
  const profileYml = readWorkspaceFile('config/profile.yml')
  const cv = `# ${resume.title}\n\n${resume.parsedText.trim()}`

  const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You generate aggregate skill-gap analysis from tracked evaluation reports and the user's CV.

Your upskill methodology is defined below. Follow it exactly.

## Shared context
${shared}

## Upskill methodology
${upskillMode}

## Your CV
${cv}

## Profile
${profileMd}

## Profile config
${profileYml}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Step 1 (Aggregator): the actual upskill.mjs script is not available. Simulate its output by analyzing the JD from the tracked reports (which will be provided) and the CV.
   - For Step 3 (Learning Plan): you cannot do live web search. Note this limitation and skip the learning plan, or provide generic study directions without live URLs.
2. Write all human-facing output in English.
3. Follow the upskill.md mode as closely as possible given tool limitations.
4. At the very end, output the full upskill analysis in a machine-readable block:

---UPSKILL---
<full upskill markdown>
---END_UPSKILL---

Also output structured metadata:
---UPSKILL_META---
SCHEMA_VERSION: <number>
REPORTS_LINKED: <number>
REPORTS_READ: <number>
REPORTS_WITH_MACHINE_SUMMARY: <number>
REPORTS_SCORED: <number>
LOW_FIT_REPORTS: <number>
GAPS: <JSON array of gaps>
EXCLUDED_AS_KNOWN: <JSON array>
KNOWN_SKILLS: <JSON array>
---END_UPSKILL_META---`

  // Build user content
  let userContent = `Generate an aggregate skill-gap analysis (upskill) based on the career-ops methodology.\n\n`

  if (options.targetedUrl) {
    userContent += `TARGETED MODE: Analyze this single JD URL instead of aggregate history:\n${options.targetedUrl}\n\n`
    userContent += `Extract required skills from this JD, suppress skills already in CV/profile, return remaining gaps as JSON.\n`
  } else {
    userContent += `AGGREGATE MODE: Analyze all tracked evaluation reports from the career-ops workspace.\n`
    userContent += `Read reports from the reports/ directory, extract gaps from low-fit (score < 4.0) reports,\n`
    userContent += `suppress skills found in CV/profile, weight by (5.0 - score), and produce the heatmap.\n\n`
    userContent += `Note: The actual upskill.mjs script reads reports/ and data/applications.md. Since those\n`
    userContent += `files are not directly accessible, simulate the analysis using the methodology.\n`
  }

  userContent += `\nFollow the upskill.md mode. Output the full report with heatmap, already covered, diff, suggested order, and learning plan (noting web search limitation).`

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
    raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude upskill generation failed: ${message}`)
  }

  if (!raw) {
    throw new Error('Claude returned empty upskill analysis.')
  }

  // Extract upskill from the response
  const upskillMatch = raw.match(/---UPSKILL---\s*([\s\S]*?)---END_UPSKILL---/)
  const metaMatch = raw.match(/---UPSKILL_META---\s*([\s\S]*?)---END_UPSKILL_META---/)

  const markdown = upskillMatch ? upskillMatch[1].trim() : raw

  let gaps: UpskillGap[] = []
  let excludedAsKnown: string[] = []
  let knownSkills: string[] = []
  let schemaVersion = 1
  let metadata = {
    reportsLinked: 0,
    reportsRead: 0,
    reportsWithMachineSummary: 0,
    reportsScored: 0,
    lowFitReports: 0,
  }
  let learningPlan: string | undefined

  if (metaMatch) {
    const meta = metaMatch[1]
    const extract = (key: string): string => {
      const line = meta.split('\n').find((l) => l.trimStart().startsWith(`${key}:`))
      return line ? line.trimStart().slice(key.length + 1).trim() : ''
    }
    const gapsJson = extract('GAPS')
    const excludedJson = extract('EXCLUDED_AS_KNOWN')
    const knownJson = extract('KNOWN_SKILLS')
    const schema = extract('SCHEMA_VERSION')
    const rl = extract('REPORTS_LINKED')
    const rr = extract('REPORTS_READ')
    const rms = extract('REPORTS_WITH_MACHINE_SUMMARY')
    const rs = extract('REPORTS_SCORED')
    const lfr = extract('LOW_FIT_REPORTS')

    if (gapsJson) {
      try { gaps = JSON.parse(gapsJson) } catch {}
    }
    if (excludedJson) {
      try { excludedAsKnown = JSON.parse(excludedJson) } catch {}
    }
    if (knownJson) {
      try { knownSkills = JSON.parse(knownJson) } catch {}
    }
    if (schema) {
      schemaVersion = parseInt(schema, 10) || 1
    }
    metadata = {
      reportsLinked: parseInt(rl, 10) || 0,
      reportsRead: parseInt(rr, 10) || 0,
      reportsWithMachineSummary: parseInt(rms, 10) || 0,
      reportsScored: parseInt(rs, 10) || 0,
      lowFitReports: parseInt(lfr, 10) || 0,
    }
  }

  // Extract learning plan section if present
  const learningPlanMatch = markdown.match(/## Learning Plan\n\n([\s\S]*?)(?=\n## |\n# |$)/)
  if (learningPlanMatch) {
    learningPlan = learningPlanMatch[1].trim()
  }

  return { markdown, gaps, excludedAsKnown, knownSkills, schemaVersion, metadata, learningPlan }
}

export interface FollowupOptions {
  /** Optional application context for more tailored follow-up */
  applicationContext?: string
  /** Specific company if different from job */
  company?: string
  /** Specific role if different from job */
  role?: string
}

export interface FollowupResult {
  /** The generated follow-up analysis markdown */
  markdown: string
  /** Suggested follow-up cadence/schedule */
  cadence?: string
  /** Draft emails/messages for each touchpoint */
  drafts?: string[]
}

/** Generate follow-up cadence and drafts using career-ops followup mode methodology. */
export async function runFollowup(args: {
  resume: CareerOpsResume
  candidate?: CareerOpsCandidate
  options?: FollowupOptions
}): Promise<FollowupResult> {
  const { resume, candidate = {}, options = {} } = args

  const ready = isCareerOpsReady()
  if (!ready.ok) throw new Error(ready.error)

  if (!anthropic) {
    throw new Error('Claude connection is not configured.')
  }

  await writeCv(resume)
  await ensureProfileYml(candidate)

  // Build system prompt from career-ops followup mode
  const shared = readWorkspaceFile('modes/_shared.md')
  const followupMode = readWorkspaceFile('modes/followup.md')
  const profileMd = readWorkspaceFile('modes/_profile.md')
  const profileYml = readWorkspaceFile('config/profile.yml')
  const cv = `# ${resume.title}\n\n${resume.parsedText.trim()}`

  const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You generate follow-up cadence and draft messages for applications from the user's CV and application context.

Your follow-up methodology is defined below. Follow it exactly.

## Shared context
${shared}

## Follow-up methodology
${followupMode}

## Your CV
${cv}

## Profile
${profileMd}

## Profile config
${profileYml}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
2. Write all human-facing output in English.
3. Follow ALL steps in the followup.md mode — do not skip steps.
4. At the very end, output the full follow-up analysis in a machine-readable block:

---FOLLOWUP---
<full follow-up markdown>
---END_FOLLOWUP---

Also output metadata:
---FOLLOWUP_META---
CADENCE: <extracted cadence/schedule>
DRAFTS: <JSON array of draft strings>
---END_FOLLOWUP_META---`

  // Build user content
  let userContent = `Generate a follow-up cadence and draft messages based on the career-ops followup methodology.\n\n`

  if (options.applicationContext) {
    userContent += `Application context:\n${options.applicationContext}\n\n`
  }
  if (options.company) {
    userContent += `Company: ${options.company}\n`
  }
  if (options.role) {
    userContent += `Role: ${options.role}\n`
  }

  userContent += `\nFollow the followup.md mode. Analyze the user's profile and generate a complete follow-up strategy with cadence and draft messages for each touchpoint.`

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
    raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude followup generation failed: ${message}`)
  }

  if (!raw) {
    throw new Error('Claude returned empty followup analysis.')
  }

  // Extract followup from the response
  const followupMatch = raw.match(/---FOLLOWUP---\s*([\s\S]*?)---END_FOLLOWUP---/)
  const metaMatch = raw.match(/---FOLLOWUP_META---\s*([\s\S]*?)---END_FOLLOWUP_META---/)

  const markdown = followupMatch ? followupMatch[1].trim() : raw

  let cadence: string | undefined
  let drafts: string[] | undefined

  if (metaMatch) {
    const meta = metaMatch[1]
    const extract = (key: string): string => {
      const line = meta.split('\n').find((l) => l.trimStart().startsWith(`${key}:`))
      return line ? line.trimStart().slice(key.length + 1).trim() : ''
    }
    cadence = extract('CADENCE') || undefined
    const draftsJson = extract('DRAFTS')
    if (draftsJson) {
      try { drafts = JSON.parse(draftsJson) } catch {}
    }
  }

  return { markdown, cadence, drafts }
}

export async function runEvaluation(args: {
  job: CareerOpsJob
  resume: CareerOpsResume
  candidate?: CareerOpsCandidate
}): Promise<CareerOpsReport> {
  const { job, resume, candidate = {} } = args

  const ready = isCareerOpsReady()
  if (!ready.ok) throw new Error(ready.error)

  const jd = job.description?.trim()
  if (!jd) {
    throw new Error('This job has no description to evaluate.')
  }
  if (!anthropic) {
    throw new Error('Claude connection is not configured.')
  }

  await writeCv(resume)
  await ensureProfileYml(candidate)

  const systemPrompt = buildSystemPrompt(resume)
  const userContent = `JOB DESCRIPTION TO EVALUATE:\n\n${jd}`

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })
    raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude evaluation failed: ${message}`)
  }

  if (!raw) {
    throw new Error('Claude returned an empty evaluation.')
  }

  try {
    assertValidReport(raw)
  } catch (error) {
    // Surface the tail of the raw output so a truncated/malformed report is
    // diagnosable instead of a dead-end "invalid report" message.
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${detail}. Raw output tail: …${raw.slice(-600).replace(/\n/g, '\\n')}`)
  }

  const summary = extractSummary(raw)
  const report: CareerOpsReport = {
    score: summary.score,
    company: summary.company || job.company,
    role: summary.role || job.title,
    archetype: summary.archetype,
    legitimacy: summary.legitimacy,
    markdown: extractMarkdown(raw),
  }

  // Save the report into the career-ops workspace (report file + tracker row)
  // when the posting URL is known. Best-effort: a persistence failure logs and
  // returns the score anyway — never discard an evaluation over file I/O.
  if (job.applyUrl) {
    const persisted = await persistCareerOpsReport(report, { rootDir: careerOpsDir(), url: job.applyUrl })
    report.reportPath = persisted.reportPath
    report.reportNumber = persisted.reportNumber
    if (persisted.error) {
      console.error(`career-ops persist warning: ${persisted.error}`)
    }
  }

  return report
}

export interface RoleSuggestion {
  /** The market job title as actually posted, not an invented hybrid. */
  title: string
  /** 1–2 lines from cv.md quoted verbatim that back the suggestion. */
  cvEvidence: string
  /** What a hiring manager would question at the candidate's level; "none" for Lateral. */
  gapNote: string
  /** How common the title is, where it's posted, seniority skew, noise level. */
  marketNote: string
  /** Shortest phrase to add to portals.yml title_filter.positive to cast a wider scan. */
  keyword: string
}

export interface SuggestRolesResult {
  /** Structured suggestions for the UI, level-calibrated. */
  suggestions: RoleSuggestion[]
  /** Full human-readable output (titles.md output contract) for display/export. */
  markdown: string
}

/**
 * Scan the user's resume and propose adjacent job titles at their recorded level
 * (career-ops `titles` mode), driven through the app's existing Claude connection.
 * Hard-binds to the candidate's seniority from config/profile.yml so senior /
 * 5+ years titles are never suggested.
 */
export async function suggestRoles(args: {
  resume: CareerOpsResume
  candidate?: CareerOpsCandidate
}): Promise<SuggestRolesResult> {
  const { resume, candidate = {} } = args

  const ready = isCareerOpsReady()
  if (!ready.ok) throw new Error(ready.error)
  if (!anthropic) {
    throw new Error('Claude connection is not configured.')
  }

  await writeCv(resume)
  await ensureProfileYml(candidate)

  // Build system prompt from career-ops titles mode (adjacent-title suggestions).
  // Deliberately NOT loading modes/_shared.md here: that file is the A–G
  // *evaluation* methodology, irrelevant to title suggestions, and the app's
  // local Claude proxy has a ~150s ceiling — keeping the input small keeps a
  // scan from hitting it. titles.md + _profile.md carry everything needed.
  const titles = readWorkspaceFile('modes/titles.md')
  const profileMd = readWorkspaceFile('modes/_profile.md')
  const profileYml = readWorkspaceFile('config/profile.yml')
  const portals = readWorkspaceFile('portals.yml')
  const cv = `# ${resume.title}\n\n${resume.parsedText.trim()}`

  const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You read the user's CV and propose adjacent job titles they aren't searching for yet, following the career-ops "titles" methodology.

Your title-suggestion methodology is defined below. Follow it exactly.

## Title-suggestion methodology
${titles}

## Your CV (source of truth)
${cv}

## Profile
${profileMd}

## Profile config
${profileYml}

## Current scan filter (portals.yml title_filter)
${portals}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools. Base everything on the CV and profile provided.
2. Write all human-facing output in English.
3. LEVEL BINDING (HARD RULE): The candidate's recorded level is in "Profile config" (target_roles.archetypes[].level) and their experience in the CV. Suggest ONLY roles credible at that level. HARD EXCLUDE any title implying seniority — senior, lead, principal, staff, architect, director, head, manager — and any role whose market standard requires 5+ years of experience. If the natural title for a skill is senior-only, do NOT suggest it; use the junior/mid equivalent or skip it. A suggestion that reads as "5+ years" is a failure.
4. Follow the titles.md output contract exactly: 5-10 suggestions, each with Title, CV evidence quoted VERBATIM, honest gap note, and market-reality note. Never invent evidence — every suggestion must be traceable to a quoted cv.md line.
5. Dedup against the current scan filter: skip any candidate title an existing positive keyword already substring-matches, and never suggest anything the negative keywords exclude (deal-breakers).
6. At the very end, output a machine-readable JSON block in this exact format (one object per suggestion, same order as the markdown). Emit it as plain text — do NOT wrap it in a markdown code fence:

---SUGGESTIONS_JSON---
[{"title":"<title>","cvEvidence":"<verbatim quote>","gapNote":"<note>","marketNote":"<note>","keyword":"<shortest search phrase>"}]
---END_SUGGESTIONS_JSON---`

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      // This model reasons heavily before writing — an uncapped thinking pass
      // spent thousands of tokens on reasoning, leaving nothing for text (the
      // proxy returned "(empty response)"), and 8000 max_tokens got eaten the
      // same way. Capping the thinking budget to 1024 lets the reasoning fit
      // comfortably and the report write in ~40s instead of timing out.
      max_tokens: 16000,
      temperature: TEMPERATURE,
      // `thinking` postdates the pinned @anthropic-ai/sdk 0.21.1, so its types
      // reject the field even though the API and the local proxy both accept
      // it. Dropping it is not an option — it is what keeps this call from
      // returning an empty response. Cast narrowly rather than widening the
      // whole call, and delete the cast when the SDK is upgraded.
      ...({ thinking: { type: 'enabled', budget_tokens: 1024 } } as object),
      system: systemPrompt,
      messages: [{
        role: 'user',
        content:
          'Scan the CV above and propose adjacent job titles at the candidate\'s level. Follow the titles.md methodology and output both the full suggestions and the SUGGESTIONS_JSON block.',
      }],
    })
    raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Claude role suggestion failed: ${message}`)
  }

  if (!raw) {
    throw new Error('Claude returned empty role suggestions.')
  }
  // The local proxy substitutes "(empty response)" when its upstream doesn't
  // finish within its ~150s window. Surface that as a retryable error instead
  // of a plausible-looking empty report.
  if (/^\s*\(empty response\)\s*$/i.test(raw.trim())) {
    throw new Error(
      'The Claude connection returned an empty response (it timed out). Try again — the scan can take 2–3 minutes.'
    )
  }

  // The report body = the model text minus the machine-readable JSON block.
  let markdown = raw.trim()
  // Unwrap a single outer code fence — models sometimes wrap the entire answer.
  if (markdown.startsWith('```') && markdown.endsWith('```')) {
    markdown = markdown.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
  }
  // Drop the machine-readable JSON: the marker form, or a ```json fence.
  markdown = markdown
    .replace(/---SUGGESTIONS_JSON---[\s\S]*?---END_SUGGESTIONS_JSON---/g, '')
    .replace(/```json\s*[\s\S]*?```/gi, '')
    .trim()

  // Prefer the machine-readable JSON when the model emitted one; otherwise fall
  // back to deriving structured suggestions from the report's markdown, which
  // follows a fixed per-suggestion contract (## N. Title + **Field:** lines).
  const fromJson = parseSuggestionsJson(raw)
  const suggestions = fromJson.length > 0 ? fromJson : parseSuggestionsFromMarkdown(markdown)

  return { suggestions, markdown }
}

/**
 * Best-effort parse of the suggestions JSON; empty array on malformed JSON.
 * Models rarely reproduce the exact markers, so this tolerates the three
 * realistic formats: an explicit markers block, a ```json code fence, or a
 * bare array left at the end of the output. Each candidate is validated —
 * the first that parses as an array of objects with `title` wins.
 */
function parseSuggestionsJson(raw: string): RoleSuggestion[] {
  const candidates: string[] = []

  const marked = raw.match(/---SUGGESTIONS_JSON---\s*(\[[\s\S]*?\])\s*---END_SUGGESTIONS_JSON---/)
  if (marked) candidates.push(marked[1])

  const fenced = raw.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
  if (fenced) candidates.push(fenced[1])

  const arrays = raw.match(/\[[\s\S]*?\]/g)
  if (arrays) candidates.push(...arrays)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (!Array.isArray(parsed) || parsed.length === 0) continue
      if (parsed.some((s) => s && typeof s.title === 'string')) {
        return parsed
          .filter((s) => s && typeof s.title === 'string' && s.title.trim())
          .map((s) => ({
            title: s.title.trim(),
            cvEvidence: typeof s.cvEvidence === 'string' ? s.cvEvidence : '',
            gapNote: typeof s.gapNote === 'string' ? s.gapNote : '',
            marketNote: typeof s.marketNote === 'string' ? s.marketNote : '',
            keyword: typeof s.keyword === 'string' ? s.keyword.trim() : s.title.trim(),
          }))
      }
    } catch {
      // malformed candidate — keep looking
    }
  }
  return []
}

/**
 * Fallback: derive structured suggestions from the report's markdown when the
 * model didn't emit a machine-readable JSON block. titles.md fixes the
 * per-suggestion contract (## N. Title followed by **Field:** lines), so this
 * is reliable even when the model skips the JSON block.
 */
function parseSuggestionsFromMarkdown(markdown: string): RoleSuggestion[] {
  const suggestions: RoleSuggestion[] = []
  // Split on each "## " heading; drop anything before the first suggestion.
  const blocks = markdown.split(/^## /m).slice(1)

  for (const block of blocks) {
    const heading = block.split('\n', 1)[0].trim()
    const title = heading.replace(/^\d+\.\s*/, '').trim()
    if (!title) continue

    const cvEvidence = (block.match(/-\s*\*\*CV evidence:\*\*\s*(.+)/i)?.[1] ?? '')
      .trim()
      .replace(/^["']|["']$/g, '')
    const gapNote = block.match(/-\s*\*\*Honest gap note:\*\*\s*(.+)/i)?.[1]?.trim() ?? ''
    const marketNote = block.match(/-\s*\*\*Market-reality note:\*\*\s*(.+)/i)?.[1]?.trim() ?? ''
    const keywordMatch = block.match(/-\s*\*\*Proposed keyword:\*\*\s*`([^`]+)`/i)
    const keyword = keywordMatch?.[1]?.trim() || title

    suggestions.push({
      title,
      cvEvidence,
      gapNote,
      marketNote,
      keyword,
    })
  }

  return suggestions
}
