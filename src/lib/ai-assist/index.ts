import Anthropic from '@anthropic-ai/sdk'
import { InterviewQuestionSet } from '@/types'
import { getRoleLabel } from '@/lib/utils'

// AI writing assist (cover letters + interview prep). Mirrors the ai-matcher
// client setup so both share the same env-var contract, but keeps its own client
// so scoring and this feature can never interfere with each other.
const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

let anthropic: Anthropic | null = null

if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
  })
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

export interface AssistJob {
  title: string
  company: string
  description: string
  skills: string[]
  roleType: string
  experienceLevel: string
}

export interface AssistResume {
  parsedText: string
  skills: string[]
}

/** Send a prompt to Anthropic and return the raw text of the first text block. */
async function complete(prompt: string, maxTokens = 1500, temperature = 0.5): Promise<string> {
  if (!anthropic) throw new Error('No Anthropic client configured')
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  })
  const textBlock = response.content.find(block => block.type === 'text')
  if (!textBlock) throw new Error('Unexpected response type')
  return textBlock.text
}

/** Pull the first JSON object out of a model response (it may add prose/code fences). */
function extractJson<T>(text: string): T | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

/** Case-insensitive overlap between the resume's skills and the job's skills. */
function overlappingSkills(resumeSkills: string[], jobSkills: string[]): string[] {
  const overlap: string[] = []
  for (const s of resumeSkills) {
    const norm = s.trim().toLowerCase()
    if (!norm) continue
    const hit = jobSkills.find(js => {
      const n = js.trim().toLowerCase()
      return n && (n.includes(norm) || norm.includes(n))
    })
    if (hit && !overlap.includes(hit.trim())) overlap.push(hit.trim())
  }
  return overlap
}

// ---------------------------------------------------------------------------
// Cover letter
// ---------------------------------------------------------------------------

const COVER_LETTER_PROMPT = `You are a career coach writing a personalized cover letter for a job application.

Write a professional, confident, 3-4 paragraph cover letter. Do NOT use headings or bullet points. Do NOT invent facts, projects, companies, or metrics that are not in the resume. Use the candidate's real experience and skills. Keep every claim traceable to the resume. End with "Sincerely," and leave the signature blank (the candidate will add their name).

JOB:
Title: {jobTitle}
Company: {company}
Role type: {roleType}
Experience level: {experienceLevel}
Description: {description}
Required skills: {skills}

RESUME (candidate):
{resume}

Return ONLY the cover letter text.`

export async function generateCoverLetter(job: AssistJob, resume: AssistResume): Promise<string> {
  if (anthropic) {
    try {
      const prompt = COVER_LETTER_PROMPT
        .replace('{jobTitle}', job.title)
        .replace('{company}', job.company)
        .replace('{roleType}', job.roleType)
        .replace('{experienceLevel}', job.experienceLevel)
        .replace('{description}', job.description.slice(0, 3000))
        .replace('{skills}', job.skills.slice(0, 30).join(', '))
        .replace('{resume}', resume.parsedText.slice(0, 8000))
      const letter = (await complete(prompt)).trim()
      if (letter.length > 80) return letter
    } catch (error) {
      console.warn('AI cover letter failed, using fallback:', error)
    }
  }

  return fallbackCoverLetter(job, resume)
}

function fallbackCoverLetter(job: AssistJob, resume: AssistResume): string {
  const overlap = overlappingSkills(resume.skills, job.skills)
  const strengths = (overlap.length >= 2 ? overlap : resume.skills).slice(0, 5)
  const roleLabel = getRoleLabel(job.roleType)
  const company = job.company || 'your company'

  return [
    `Dear Hiring Team,`,
    ``,
    `I'm excited to apply for the ${job.title} role at ${company}. As a ${roleLabel.toLowerCase()} with hands-on experience in ${strengths.join(', ')}, I'm confident I can make an impact quickly and help the team move faster.`,
    ``,
    `In my recent work I've built and shipped features end-to-end, collaborating across engineering and product to turn ambiguous problems into working software. The responsibilities in this posting — ${job.skills.slice(0, 5).join(', ') || 'delivering high-quality work'} — align closely with what I enjoy and do best, and I'd welcome the chance to apply that experience to ${company}'s challenges.`,
    ``,
    `I've attached my resume and would love to discuss how my background fits what you're building. Thank you for your time and consideration.`,
    ``,
    `Sincerely,`,
    `[Your Name]`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Cold email
// ---------------------------------------------------------------------------

const COLD_EMAIL_PROMPT = `You are a career coach writing a short cold outreach email to a recruiter or hiring manager at a company the candidate wants to work for.

Write a professional, concise cold email (NOT a cover letter). Put the subject line on the first line, prefixed with "Subject: ". The email must:
- Open with a polite greeting. Use "Hi there," since the recipient's name is unknown.
- State in one sentence why the candidate is reaching out: the specific role at the company.
- Pitch the candidate in 2-3 short sentences using ONLY real experience and skills from the resume — no invented projects, titles, companies, or metrics.
- Optionally reference one specific thing from the job description that connects to the candidate's background.
- End with a single, low-pressure call to action: asking for a brief chat or whether the role is still open.
- Sign with "[Your Name]" and a placeholder line "[Your email] · [Your phone]" so the candidate can fill in contact info.

Keep it under 180 words. Do NOT use headings or bullet points. Do NOT open with "I've attached my resume" — a cold email has to earn the reply first.

JOB:
Title: {jobTitle}
Company: {company}
Role type: {roleType}
Experience level: {experienceLevel}
Description: {description}
Required skills: {skills}

RESUME (candidate):
{resume}

Return ONLY the email text.`

export async function generateColdEmail(job: AssistJob, resume: AssistResume): Promise<string> {
  if (anthropic) {
    try {
      const prompt = COLD_EMAIL_PROMPT
        .replace('{jobTitle}', job.title)
        .replace('{company}', job.company)
        .replace('{roleType}', job.roleType)
        .replace('{experienceLevel}', job.experienceLevel)
        .replace('{description}', job.description.slice(0, 3000))
        .replace('{skills}', job.skills.slice(0, 30).join(', '))
        .replace('{resume}', resume.parsedText.slice(0, 8000))
      const email = (await complete(prompt, 1000, 0.6)).trim()
      if (email.length > 50) return email
    } catch (error) {
      console.warn('AI cold email failed, using fallback:', error)
    }
  }

  return fallbackColdEmail(job, resume)
}

function fallbackColdEmail(job: AssistJob, resume: AssistResume): string {
  const overlap = overlappingSkills(resume.skills, job.skills)
  const strengths = (overlap.length >= 2 ? overlap : resume.skills).slice(0, 4)
  const roleLabel = getRoleLabel(job.roleType).toLowerCase()
  const company = job.company || 'your company'
  const leadSkill = strengths[0] || job.skills[0]
  const subject = leadSkill
    ? `${leadSkill} ${roleLabel} — interested in the ${job.title} role`
    : `${roleLabel} — interested in the ${job.title} role`

  return [
    `Subject: ${subject}`,
    ``,
    `Hi there,`,
    ``,
    `I'm reaching out because I saw you're hiring for a ${job.title} role at ${company}, and it looks like a strong fit for my background — I'm a ${roleLabel} with hands-on experience in ${strengths.join(', ') || 'building and shipping software end-to-end'}.`,
    ``,
    `I've spent the last few years taking products from idea to launch, and the role's focus on ${job.skills.slice(0, 3).join(', ') || 'delivering high-quality work'} is exactly the kind of work I do best. I'd love to bring that experience to ${company}.`,
    ``,
    `Would you be open to a brief chat this week to see if I could be a good fit?`,
    ``,
    `Best,`,
    `[Your Name]`,
    `[Your email] · [Your phone]`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Interview prep
// ---------------------------------------------------------------------------

const INTERVIEW_PROMPT = `You are an interview coach preparing a candidate for a job interview. Given the job posting and the candidate's resume, generate realistic interview questions the interviewer is likely to ask.

Return ONLY a JSON object, with no markdown and no commentary, in this exact shape:
{
  "groups": [
    {
      "category": "Technical",
      "questions": [
        { "question": "...", "why": "what a strong answer should demonstrate" }
      ]
    },
    {
      "category": "Behavioral",
      "questions": [ { "question": "...", "why": "..." } ]
    },
    {
      "category": "Company & Role",
      "questions": [ { "question": "...", "why": "..." } ]
    }
  ]
}

Rules:
- 4-6 questions in Technical, 3-4 in Behavioral, 2-3 in Company & Role (about 10 total).
- Technical questions must be specific to the job's required skills (use the skills list).
- Where the resume already covers a skill, ask the candidate to walk through real experience with it. Where the resume is missing a required skill, ask how they'd ramp up on it.
- Behavioral questions use the STAR format and probe real situations from the resume.
- Do not invent facts about the candidate.

JOB:
Title: {jobTitle}
Company: {company}
Role type: {roleType}
Experience level: {experienceLevel}
Required skills: {skills}
Description: {description}

RESUME (candidate):
{resume}`

export async function generateInterviewQuestions(job: AssistJob, resume: AssistResume): Promise<InterviewQuestionSet> {
  if (anthropic) {
    try {
      const prompt = INTERVIEW_PROMPT
        .replace('{jobTitle}', job.title)
        .replace('{company}', job.company)
        .replace('{roleType}', job.roleType)
        .replace('{experienceLevel}', job.experienceLevel)
        .replace('{skills}', job.skills.slice(0, 30).join(', '))
        .replace('{description}', job.description.slice(0, 3000))
        .replace('{resume}', resume.parsedText.slice(0, 8000))
      const raw = await complete(prompt, 2000, 0.4)
      const parsed = extractJson<InterviewQuestionSet>(raw)
      if (parsed?.groups?.length) {
        const groups = parsed.groups
          .filter(g => g.category && Array.isArray(g.questions) && g.questions.length)
          .map(g => ({ category: g.category, questions: g.questions.slice(0, 8) }))
        if (groups.length) return { groups }
      }
      console.warn('AI interview prep returned unparseable JSON, using fallback')
    } catch (error) {
      console.warn('AI interview prep failed, using fallback:', error)
    }
  }

  return fallbackInterviewQuestions(job, resume)
}

function fallbackInterviewQuestions(job: AssistJob, resume: AssistResume): InterviewQuestionSet {
  const overlap = overlappingSkills(resume.skills, job.skills)
  const overlapSet = new Set(overlap.map(s => s.toLowerCase()))
  const roleLabel = getRoleLabel(job.roleType)

  const technical = (job.skills.slice(0, 6) || []).map(skill => {
    const covered = overlapSet.has(skill.toLowerCase())
    return covered
      ? {
          question: `Walk me through a project where you used ${skill}. What problem were you solving and what did you build?`,
          why: `Shows hands-on ${skill} experience and your ability to apply it to real problems.`,
        }
      : {
          question: `This role lists ${skill} as a requirement. Have you worked with it, or how would you ramp up on it quickly?`,
          why: `Checks your honesty about gaps and how fast you can learn a tool this team relies on.`,
        }
  })

  const behavioral = [
    {
      question: 'Tell me about a time you had to debug a difficult problem that took longer than expected. How did you work through it?',
      why: 'Evaluates your debugging process and persistence under pressure.',
    },
    {
      question: 'Describe a time you disagreed with a teammate or stakeholder about the right approach. How was it resolved?',
      why: 'Shows communication, ego management, and collaboration skills.',
    },
    {
      question: 'What is a project or result from your resume you are most proud of, and what was your specific contribution?',
      why: 'Lets you lead the narrative and prove ownership with a concrete example.',
    },
  ]

  const companyRole = [
    {
      question: `Why are you interested in this ${roleLabel.toLowerCase()} role, and why ${job.company || 'this company'}?`,
      why: 'Tests genuine interest and whether you have researched the company.',
    },
    {
      question: `How does your experience map to the responsibilities in this ${roleLabel.toLowerCase()} position?`,
      why: 'Confirms you can connect your background to what the role actually needs.',
    },
    {
      question: 'Where do you see yourself growing in this role over the next year or two?',
      why: 'Assesses ambition and whether the role fits your career direction.',
    },
  ]

  return {
    groups: [
      { category: 'Technical', questions: technical },
      { category: 'Behavioral', questions: behavioral },
      { category: 'Company & Role', questions: companyRole },
    ],
  }
}
