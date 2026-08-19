import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/auth'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/chat — interview-prep chat.
// The candidate enters a target job role + picks a resume version, then asks
// interview-style questions. Each turn sends the running message history plus a
// system prompt that injects the resume (ground truth) and target role, so the
// answer is framed for that role and never invents experience.
//
// Uses its own local Anthropic client (same contract as the linkedin-message
// route) rather than the career-ops lib's readiness gate, so it works
// independently of the career-ops workspace setup.

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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

function buildSystemPrompt(jobRole: string, resumeText: string): string {
  return `You are a career coach and interview-prep assistant. Help the candidate answer interview questions for a specific role, using ONLY their resume as the source of truth.

TARGET ROLE: ${jobRole}

CANDIDATE RESUME:
${resumeText.slice(0, 9000)}

Guidelines:
- Frame every answer as if the candidate is replying to that interview question for the TARGET ROLE.
- Ground all claims in the resume. Do NOT invent experience, companies, metrics, or projects that aren't in the resume.
- Be concise but complete; use short paragraphs or bullets when helpful.
- If the resume lacks the relevant experience, say so honestly and suggest how to bridge the gap.
- Keep a professional interview tone.`
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
    const { jobRole, resumeId, messages } = body as {
      jobRole?: string
      resumeId?: string
      messages?: ChatMessage[]
    }

    if (!jobRole?.trim()) {
      return NextResponse.json({ error: 'Provide a target job role first.' }, { status: 400 })
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages to respond to.' }, { status: 400 })
    }

    const last = messages[messages.length - 1]
    if (last.role !== 'user') {
      return NextResponse.json({ error: 'The last message must be from the user.' }, { status: 400 })
    }

    // Resolve the resume the candidate picked (defaults to latest).
    const resume = await getResumeForUser(user.id, resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — the chat answers from it.' },
        { status: 400 }
      )
    }

    const system = buildSystemPrompt(jobRole.trim(), resume.parsedText || '')

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.4,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response from Claude.' }, { status: 500 })
    }

    return NextResponse.json({ reply: textBlock.text })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get a response.'
    console.error('Chat error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
