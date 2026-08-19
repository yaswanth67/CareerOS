import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/auth'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/chat-cover — generate a cover letter from the chat context.
// The chat already has: target job role, selected resume, and conversation history.
// We use that context to generate a tailored cover letter.

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

function buildCoverLetterPrompt(
  jobRole: string,
  resumeText: string,
  chatHistory: ChatMessage[]
): string {
  // Extract key themes from chat history to inform the cover letter
  const chatContext = chatHistory
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n')

  return `You are a career coach writing a tailored cover letter. Use ONLY the information below — do not invent experience, companies, metrics, or projects.

TARGET ROLE: ${jobRole}

CANDIDATE RESUME:
${resumeText.slice(0, 10000)}

INTERVIEW CHAT CONTEXT (questions the candidate has been practicing):
${chatContext.slice(0, 5000)}

Guidelines:
- Write a professional cover letter for the TARGET ROLE.
- Ground every claim in the RESUME. Do NOT invent experience.
- Use the CHAT CONTEXT to understand what aspects of their experience they want to highlight (they've been practicing answers for these topics).
- Standard cover letter format: greeting, opening paragraph (role + enthusiasm), 2-3 body paragraphs connecting experience to role requirements, closing paragraph (call to action), sign-off.
- Keep it concise: 250-400 words.
- Use a confident, professional tone.
- Address it generically (e.g., "Dear Hiring Manager") since we don't have a specific company.
- Do NOT include any job links, URLs, or application links.
- Output ONLY the cover letter text — no markdown formatting, no extra commentary.`
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
      return NextResponse.json({ error: 'No chat history to generate cover letter from.' }, { status: 400 })
    }

    // Resolve the resume the candidate picked (defaults to latest).
    const resume = await getResumeForUser(user.id, resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — the cover letter is grounded in it.' },
        { status: 400 }
      )
    }

    const prompt = buildCoverLetterPrompt(jobRole.trim(), resume.parsedText || '', messages)

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response from Claude.' }, { status: 500 })
    }

    return NextResponse.json({ coverLetter: textBlock.text })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate cover letter.'
    console.error('Chat cover letter error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}