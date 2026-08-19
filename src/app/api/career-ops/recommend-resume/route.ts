import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/career-ops/recommend-resume — recommend the best resume for a target role.
// Evaluates each resume against the job role using a lightweight Claude call.

interface ResumeOption {
  id: string
  title: string | null
  parsedText: string
}

interface ResumeScore {
  resumeId: string
  title: string | null
  score: number
  reason: string
}

const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY
let anthropic: Anthropic | null = null
if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
  })
}
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

function buildEvaluationPrompt(jobRole: string, resume: ResumeOption): string {
  return `You are a career coach. Evaluate how well this resume fits the target role.

TARGET ROLE: ${jobRole}

RESUME:
Title: ${resume.title || 'Untitled'}
Content:
${resume.parsedText.slice(0, 8000)}

Return a JSON object with exactly these fields:
{
  "score": <number 0-5, one decimal place>,
  "reason": "<one sentence explaining the score, max 160 chars>"
}

Scoring guide:
- 5.0: Perfect match — resume directly demonstrates the core requirements
- 4.0: Strong match — most requirements covered with relevant experience
- 3.0: Moderate match — some relevant experience, notable gaps
- 2.0: Weak match — limited relevant experience, significant gaps
- 1.0: Poor match — minimal relevant experience
- 0.0: No match — completely unrelated background

Be strict. Do not inflate scores.`
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

    const body = await request.json().catch(() => ({}))
    const { jobRole, resumeIds } = body as {
      jobRole?: string
      resumeIds?: string[]
    }

    if (!jobRole?.trim()) {
      return NextResponse.json({ error: 'Provide a target job role.' }, { status: 400 })
    }

    if (!Array.isArray(resumeIds) || resumeIds.length === 0) {
      return NextResponse.json({ error: 'Provide at least one resume ID.' }, { status: 400 })
    }

    // Fetch all resumes for this user
    const resumes = await prisma.resume.findMany({
      where: {
        userId: user.id,
        id: { in: resumeIds },
      },
      select: { id: true, title: true, parsedText: true },
    })

    if (resumes.length === 0) {
      return NextResponse.json({ error: 'No valid resumes found.' }, { status: 404 })
    }

    // Evaluate each resume in parallel
    const evaluations = await Promise.all(
      resumes.map(async (resume) => {
        try {
          const response = await anthropic!.messages.create({
            model: MODEL,
            max_tokens: 300,
            temperature: 0.2,
            messages: [{ role: 'user', content: buildEvaluationPrompt(jobRole.trim(), resume) }],
          })

          const textBlock = response.content.find(block => block.type === 'text')
          if (!textBlock || textBlock.type !== 'text') {
            return { resumeId: resume.id, title: resume.title, score: 0, reason: 'Evaluation failed' }
          }

          // Parse JSON from response
          const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            return { resumeId: resume.id, title: resume.title, score: 0, reason: 'Could not parse evaluation' }
          }

          const parsed = JSON.parse(jsonMatch[0])
          return {
            resumeId: resume.id,
            title: resume.title,
            score: Math.max(0, Math.min(5, Number(parsed.score) || 0)),
            reason: String(parsed.reason || 'No reason provided').slice(0, 160),
          }
        } catch {
          return { resumeId: resume.id, title: resume.title, score: 0, reason: 'Evaluation error' }
        }
      })
    )

    // Sort by score descending
    evaluations.sort((a, b) => b.score - a.score)

    const recommended = evaluations[0]
    const allScores = evaluations.map(e => ({
      resumeId: e.resumeId,
      title: e.title,
      score: e.score,
      reason: e.reason,
    }))

    return NextResponse.json({ recommended, allScores })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to recommend resume.'
    console.error('Recommend resume error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}