import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/auth'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/fast-resume — generate a tailored resume using Claude directly.
// Optimized for ATS (90%+) and job-role match (90%+). Returns markdown + PDF.

const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY
let anthropic: Anthropic | null = null
if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
  })
}
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

interface FastResumeRequest {
  jobRole: string
  resumeId?: string
  jobDescription?: string
  company?: string
  targetFormat?: 'markdown' | 'pdf'
}

function buildFastResumePrompt(
  jobRole: string,
  jobDescription: string | undefined,
  resumeText: string,
  resumeTitle: string | null,
  company: string | undefined
): string {
  const jdSection = jobDescription?.trim()
    ? `\n\nJOB DESCRIPTION:\n${jobDescription.trim()}`
    : ''

  const companySection = company?.trim()
    ? `\n\nCOMPANY: ${company.trim()}`
    : ''

  return `You are an expert ATS resume writer and career strategist. Generate a tailored resume that:
1. PASSES 90%+ ATS screening (keyword density, formatting, section headers, standard structure)
2. MATCHES 90%+ of the target job role requirements
3. Uses ONLY the candidate's actual experience — NEVER invent companies, dates, metrics, projects, or skills
4. Preserves the original resume's visual structure/format as closely as possible

TARGET ROLE: ${jobRole}${companySection}${jdSection}

CANDIDATE'S ORIGINAL RESUME:
Title: ${resumeTitle || 'Resume'}
Content:
${resumeText}

CRITICAL RULES:
- Do NOT invent any experience, company, metric, project, certification, or skill not in the original resume
- Do NOT change employment dates, company names, or role titles
- You MAY: reorder sections, rephrase bullets, add/remove keywords, tailor summary, emphasize relevant achievements, adjust skill groupings
- Use standard ATS-friendly section headers: PROFESSIONAL SUMMARY, TECHNICAL SKILLS, PROFESSIONAL EXPERIENCE, EDUCATION, PROJECTS (if applicable), CERTIFICATIONS (if applicable)
- Lead each bullet with strong action verbs + quantified impact where possible
- Weave job-relevant keywords naturally throughout (from JD + role requirements)
- Keep format clean: no columns, tables, graphics, headers/footers, or special characters that break ATS parsing
- Output ONLY the resume in clean markdown format — no commentary, no markdown code fences

ATS OPTIMIZATION CHECKLIST (must satisfy):
✓ Standard section headers (EXPERIENCE, SKILLS, EDUCATION, SUMMARY)
✓ Keywords from JD appear 3-5x each in context
✓ No tables, columns, images, or text boxes
✓ Simple bullet points (• or -)
✓ Consistent date format (MM/YYYY or Month YYYY)
✓ Skills grouped by category (Languages, Frameworks, Tools, Cloud, etc.)
✓ Quantified achievements (%, $, time saved, scale)
✓ Reverse chronological order
✓ Contact info at top (preserve from original if present)

OUTPUT FORMAT (markdown):
# [FULL NAME]
[Email] | [Phone] | [Location] | [LinkedIn] | [Portfolio/GitHub]

## PROFESSIONAL SUMMARY
[2-3 lines tailored to target role, keyword-rich, quantified impact]

## TECHNICAL SKILLS
**Languages:** [...]
**Frameworks & Libraries:** [...]
**Cloud & DevOps:** [...]
**Databases:** [...]
**Tools & Platforms:** [...]
**Methodologies:** [...]

## PROFESSIONAL EXPERIENCE
### [Role Title] — [Company] | [Dates]
- [Keyword-rich bullet 1 with quantified result]
- [Keyword-rich bullet 2 with quantified result]
- [Keyword-rich bullet 3 with quantified result]

### [Previous Role] — [Company] | [Dates]
- [...]

## PROJECTS (if applicable)
### [Project Name] | [Tech Stack]
- [Bullet with outcome/keywords]

## EDUCATION
[Degree] — [Institution] | [Year]

## CERTIFICATIONS (if applicable)
- [Cert Name] — [Issuer] | [Year]`
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!anthropic) {
      return NextResponse.json(
        { error: 'Claude is not configured on the server. Set ANTHROPIC_AUTH_TOKEN.' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({})) as FastResumeRequest
    const { jobRole, resumeId, jobDescription, company, targetFormat = 'markdown' } = body

    if (!jobRole?.trim()) {
      return NextResponse.json({ error: 'Provide a target job role.' }, { status: 400 })
    }

    // Fetch the user's resume
    const resume = await getResumeForUser(user.id, resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — the tailored resume is grounded in it.' },
        { status: 400 }
      )
    }

    const prompt = buildFastResumePrompt(
      jobRole.trim(),
      jobDescription?.trim(),
      resume.parsedText || '',
      resume.title,
      company?.trim()
    )

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response from Claude.' }, { status: 500 })
    }

    const markdown = textBlock.text.trim()

    if (targetFormat === 'pdf') {
      // Return markdown; client will generate PDF with jsPDF preserving format
      return NextResponse.json({ markdown, format: 'pdf' })
    }

    return NextResponse.json({ markdown, format: 'markdown' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate fast resume.'
    console.error('Fast resume error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}