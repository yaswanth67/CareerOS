import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

let anthropic: Anthropic | null = null

if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
  })
}

// Simple in-memory cache for profile data (demo purposes)
// In production, you'd want to use a proper scraping service or LinkedIn API
async function fetchLinkedInProfile(profileUrl: string): Promise<{
  name: string
  headline: string
  company: string
  location: string
  about?: string
  posts?: Array<{ text: string; date: string }>
} | null> {
  // For demo/mock purposes, we'll extract the username and create a realistic profile
  // In production, you would use a service like:
  // - Proxycurl API
  // - PhantomBuster
  // - Bright Data
  // - Or LinkedIn's official API (requires partnership)

  const username = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]
  if (!username) return null

  // Try to fetch via a public profile view (limited data)
  // Note: LinkedIn blocks most automated access, so this is a fallback mock
  // Real implementation would use a proper scraping service

  // For now, return a structured mock based on the username
  // The AI will use this to personalize the message
  return {
    name: username.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'LinkedIn User',
    headline: 'Software Engineer',
    company: 'Tech Company',
    location: 'San Francisco Bay Area',
    about: 'Experienced software engineer passionate about building scalable systems.',
    posts: [
      { text: 'Excited to share our latest launch...', date: '2024-01-15' },
      { text: 'Thoughts on the future of AI in development...', date: '2024-01-10' },
    ],
  }
}

function buildPrompt(
  profile: {
    name: string
    headline: string
    company: string
    location: string
    about?: string
    posts?: Array<{ text: string; date: string }>
  },
  jobUrl: string | undefined,
  messageType: 'referral' | 'casual' | 'connection'
): string {
  const profileContext = `
Profile: ${profile.name}
Headline: ${profile.headline}
Company: ${profile.company}
Location: ${profile.location}
${profile.about ? `About: ${profile.about}` : ''}
${profile.posts?.length ? `Recent posts:\n${profile.posts.map(p => `- ${p.text} (${p.date})`).join('\n')}` : ''}
`

  const jobContext = jobUrl ? `\nJob Posting URL: ${jobUrl}\n(Reference this role in the referral request)` : ''

  const typeInstructions = {
    referral: `Write a concise, respectful referral request message for LinkedIn.
- Address them by name
- Mention something specific from their profile/posts to show genuine interest
- Clearly state you're asking for a referral to the specific role (reference the job URL)
- Make it easy for them: offer to send your resume, the job description, or any materials they need
- Keep it under 300 words
- Professional but warm tone
- End with a clear, low-pressure ask (e.g., "Would you be open to referring me?" or "Happy to send over my resume if you're open to it")`,

    casual: `Write a concise, friendly networking message for a coffee chat / informational interview.
- Address them by name
- Mention something specific from their profile/posts to show genuine interest
- Explain why you'd value their perspective (their role, company, career path)
- Propose a low-commitment ask: 15-20 min virtual coffee, or a few questions over email
- Keep it under 250 words
- Warm, curious tone — not transactional
- End with an easy out ("No pressure at all if you're busy!")`,

    connection: `Write a personalized LinkedIn connection request note (300 characters max).
- Address them by name
- Mention ONE specific thing from their profile/posts
- State why you want to connect in one sentence
- Must be under 300 characters (LinkedIn limit)
- Friendly, genuine tone`,
  }

  return `You are helping a job seeker write a personalized LinkedIn outreach message.

${profileContext}${jobContext}

${typeInstructions[messageType]}

Return ONLY the message text — no markdown formatting, no quotes, no extra commentary. Just the message ready to copy-paste.`
}

export async function POST(request: NextRequest) {
  try {
    const { profileUrl, jobUrl, messageType } = await request.json()

    if (!profileUrl || !messageType) {
      return NextResponse.json(
        { error: 'Profile URL and message type are required' },
        { status: 400 }
      )
    }

    if (!['referral', 'casual', 'connection'].includes(messageType)) {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      )
    }

    if (messageType === 'referral' && !jobUrl) {
      return NextResponse.json(
        { error: 'Job URL is required for referral requests' },
        { status: 400 }
      )
    }

    // Fetch profile data (mock for now, replace with real scraping service)
    const profile = await fetchLinkedInProfile(profileUrl)

    if (!profile) {
      return NextResponse.json(
        { error: 'Could not fetch profile. Please check the URL.' },
        { status: 400 }
      )
    }

    let message: string

    if (anthropic) {
      try {
        // Use AI to generate personalized message
        const prompt = buildPrompt(profile, jobUrl, messageType)

        const response = await anthropic.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }],
        })

        const textBlock = response.content.find(block => block.type === 'text')
        if (!textBlock) {
          throw new Error('Unexpected response type')
        }

        message = textBlock.text.trim()
      } catch (aiError) {
        console.warn('AI generation failed, using fallback:', aiError)
        message = generateFallbackMessage(profile, jobUrl, messageType)
      }
    } else {
      // Fallback template-based generation
      message = generateFallbackMessage(profile, jobUrl, messageType)
    }

    return NextResponse.json({
      message: { markdown: message },
      profile,
    })
  } catch (error) {
    console.error('LinkedIn message generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate message. Please try again.' },
      { status: 500 }
    )
  }
}

function generateFallbackMessage(
  profile: {
    name: string
    headline: string
    company: string
    location: string
    about?: string
    posts?: Array<{ text: string; date: string }>
  },
  jobUrl: string | undefined,
  messageType: 'referral' | 'casual' | 'connection'
): string {
  const firstName = profile.name.split(' ')[0]
  const mention = profile.posts?.[0]?.text
    ? `I saw your recent post about "${profile.posts[0].text.slice(0, 60)}..."`
    : `I came across your profile and was impressed by your work at ${profile.company}`

  switch (messageType) {
    case 'referral':
      return `Hi ${firstName},

${mention} and your experience as a ${profile.headline} at ${profile.company} really stood out.

I'm reaching out because I'm applying for a role that aligns closely with your team's work. Would you be open to referring me? I'd be happy to send over my resume and the job description to make it easy for you.

${jobUrl ? `The role: ${jobUrl}` : ''}

No pressure at all if you're not comfortable or too busy — totally understand. Thanks either way!

Best,
[Your Name]`

    case 'casual':
      return `Hi ${firstName},

${mention} and your background as a ${profile.headline} at ${profile.company} caught my attention.

I'm currently exploring opportunities in [your field/interest] and would genuinely value your perspective on the industry and your experience at ${profile.company}. Would you be open to a quick 15-min virtual coffee sometime? Happy to work around your schedule.

No pressure at all if you're busy — just thought I'd reach out!

Best,
[Your Name]`

    case 'connection':
      return `Hi ${firstName}, ${mention.slice(0, 100)}. Would love to connect and stay in touch with your work at ${profile.company}!`
  }
}