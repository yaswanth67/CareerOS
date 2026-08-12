import pdfParse from 'pdf-parse'
import { extractRawText } from 'mammoth'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client only if an API key/token is available.
// ANTHROPIC_AUTH_TOKEN is used when talking to a local Claude Code connection.
const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

let anthropic: Anthropic | null = null

if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
  })
}

interface ParsedResume {
  title?: string
  roleType?: string
  text: string
  skills: string[]
  experience: Array<{
    role: string
    company: string
    duration: string
    achievements: string[]
  }>
  education: Array<{
    degree: string
    school: string
    year: string
  }>
}

const TECH_SKILLS = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB',
  // Frontend
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Remix', 'Astro', 'HTML', 'CSS', 'Tailwind', 'Sass', 'Styled Components',
  // Backend
  'Node.js', 'Express', 'Fastify', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'ASP.NET', 'Rails', 'Laravel',
  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB', 'Cassandra', 'Elasticsearch', 'Prisma', 'TypeORM', 'Sequelize',
  // Cloud & DevOps
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI',
  // AI/ML
  'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Hugging Face', 'Transformers', 'LangChain', 'LlamaIndex', 'OpenAI API',
  'MLOps', 'Kubeflow', 'MLflow', 'Weights & Biases',
  // Data
  'Pandas', 'NumPy', 'Spark', 'Hadoop', 'Kafka', 'Airflow', 'dbt', 'Snowflake', 'BigQuery', 'Tableau', 'Power BI',
  // Other
  'Git', 'Linux', 'GraphQL', 'REST', 'gRPC', 'WebSocket', 'Microservices', 'Serverless', 'CI/CD', 'Testing', 'TDD',
]

function extractSkills(text: string): string[] {
  const foundSkills = new Set<string>()

  for (const skill of TECH_SKILLS) {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(text)) {
      foundSkills.add(skill)
    }
  }

  return Array.from(foundSkills)
}

function extractExperience(text: string): Array<{ role: string; company: string; duration: string; achievements: string[] }> {
  // Simple heuristic extraction - works offline
  const experience: Array<{ role: string; company: string; duration: string; achievements: string[] }> = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let currentRole = ''
  let currentCompany = ''
  let currentDuration = ''
  let achievements: string[] = []

  for (const line of lines) {
    // Look for role patterns
    const roleMatch = line.match(/^(Software Engineer|Developer|Intern|Researcher|Data Scientist|ML Engineer|AI Engineer|DevOps|Full Stack|Frontend|Backend|Mobile|QA|Product Manager|Engineer|Architect|Lead|Manager|Director)/i)
    if (roleMatch && currentRole) {
      experience.push({ role: currentRole, company: currentCompany, duration: currentDuration, achievements })
      currentRole = roleMatch[1]
      currentCompany = ''
      currentDuration = ''
      achievements = []
      continue
    }

    if (roleMatch) {
      currentRole = roleMatch[1]
      continue
    }

    // Look for company patterns
    const companyMatch = line.match(/^(Google|Microsoft|Amazon|Meta|Apple|Netflix|Uber|Airbnb|Stripe|OpenAI|Anthropic|NVIDIA|Tesla|SpaceX|[A-Z][a-z]+(?: [A-Z][a-z]+)*)/i)
    if (companyMatch && !currentCompany && currentRole) {
      currentCompany = companyMatch[1]
      continue
    }

    // Look for date patterns
    const dateMatch = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[-–]\s*(Present|Current|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i)
    if (dateMatch && currentRole) {
      currentDuration = dateMatch[0]
      continue
    }

    // Achievements (bullet points)
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      if (currentRole) {
        achievements.push(line.replace(/^[•\-*]\s*/, ''))
      }
    }
  }

  if (currentRole) {
    experience.push({ role: currentRole, company: currentCompany, duration: currentDuration, achievements })
  }

  return experience
}

function extractEducation(text: string): Array<{ degree: string; school: string; year: string }> {
  const education: Array<{ degree: string; school: string; year: string }> = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const degreeKeywords = ['Bachelor', 'Master', 'PhD', 'Ph.D', 'BS', 'MS', 'BA', 'MA', 'BSc', 'MSc', 'MBA', 'B.Tech', 'M.Tech']

  for (const line of lines) {
    for (const keyword of degreeKeywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(line)) {
        const yearMatch = line.match(/\b(19|20)\d{2}\b/)
        education.push({
          degree: line,
          school: '',
          year: yearMatch ? yearMatch[0] : '',
        })
        break
      }
    }
  }

  return education
}

function detectRoleType(skills: string[], experience: Array<{ role: string }>): string {
  const skillSet = new Set(skills.map(s => s.toLowerCase()))
  const roles = experience.map(e => e.role.toLowerCase()).join(' ')

  // AI/ML Engineer
  if (
    skillSet.has('pytorch') || skillSet.has('tensorflow') || skillSet.has('transformers') ||
    skillSet.has('langchain') || skillSet.has('llms') || skillSet.has('mlops') ||
    roles.includes('ml engineer') || roles.includes('ai engineer') || roles.includes('machine learning')
  ) {
    return 'AI_ENGINEER'
  }

  // Data Scientist
  if (
    skillSet.has('pandas') || skillSet.has('numpy') || skillSet.has('scikit-learn') ||
    skillSet.has('tableau') || skillSet.has('power bi') || roles.includes('data scientist')
  ) {
    return 'DATA_SCIENTIST'
  }

  // Data Engineer
  if (
    skillSet.has('spark') || skillSet.has('kafka') || skillSet.has('airflow') ||
    skillSet.has('dbt') || skillSet.has('snowflake') || roles.includes('data engineer')
  ) {
    return 'DATA_ENGINEER'
  }

  // DevOps/SRE
  if (
    skillSet.has('kubernetes') || skillSet.has('docker') || skillSet.has('terraform') ||
    skillSet.has('ansible') || roles.includes('devops') || roles.includes('sre')
  ) {
    return 'DEVOPS'
  }

  // Frontend
  if (
    skillSet.has('react') || skillSet.has('vue') || skillSet.has('angular') ||
    skillSet.has('next.js') || roles.includes('frontend')
  ) {
    return 'FRONTEND'
  }

  // Backend
  if (
    skillSet.has('node.js') || skillSet.has('django') || skillSet.has('fastapi') ||
    skillSet.has('spring boot') || roles.includes('backend')
  ) {
    return 'BACKEND'
  }

  // Full Stack
  if (
    (skillSet.has('react') || skillSet.has('vue') || skillSet.has('angular')) &&
    (skillSet.has('node.js') || skillSet.has('django') || skillSet.has('fastapi'))
  ) {
    return 'FULLSTACK'
  }

  return 'SDE'
}

async function extractSkillsWithAI(text: string): Promise<string[]> {
  // If no API key, use keyword-based extraction
  if (!anthropic) {
    return extractSkills(text)
  }

  const prompt = `Extract all technical skills from this resume text. Return ONLY a JSON array of skill names (strings).

Resume text:
${text.slice(0, 8000)}

Return format: ["Skill1", "Skill2", "Skill3", ...]
Include: programming languages, frameworks, databases, cloud platforms, tools, methodologies, etc.
Be specific (e.g., "React" not "Frontend", "PostgreSQL" not "Databases").`

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    })

    // Local Claude proxies may prepend a "thinking" block, so find the text block.
    // Also handle cases where the text block might contain explanation before the JSON array.
    const textBlock = response.content.find(block => block.type === 'text')
    if (textBlock) {
      // Try to extract JSON array from the response text (handles thinking blocks or explanatory text)
      const text = textBlock.text.trim()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      const jsonText = jsonMatch ? jsonMatch[0] : text

      // Robust JSON parsing with validation
      let skills: unknown
      try {
        skills = JSON.parse(jsonText)
      } catch (parseError) {
        console.warn('Failed to parse AI skills response as JSON, trying to extract manually:', parseError)
        // Try to manually extract skills from malformed JSON
        const skillMatches = jsonText.match(/"([^"]+)"/g)
        if (skillMatches) {
          skills = skillMatches.map(m => m.replace(/"/g, ''))
        } else {
          throw parseError
        }
      }

      if (Array.isArray(skills)) {
        // Normalize skill names
        return skills.map(s => String(s).trim()).filter(Boolean)
      }
    }
  } catch (error) {
    console.error('AI skill extraction failed, falling back:', error)
  }

  return extractSkills(text) // Fallback
}

async function extractExperienceWithAI(text: string): Promise<Array<{ role: string; company: string; duration: string; achievements: string[] }>> {
  // If no API key, use heuristic extraction
  if (!anthropic) {
    return extractExperience(text)
  }

  const prompt = `Extract work experience from this resume text. Return ONLY a JSON array of objects with these fields:
- role: job title
- company: company name
- duration: employment period (e.g., "Jan 2022 - Present")
- achievements: array of accomplishment strings

Resume text:
${text.slice(0, 8000)}

Return format: [{"role": "...", "company": "...", "duration": "...", "achievements": ["...", "..."]}, ...]`

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 1500,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    })

    // Local Claude proxies may prepend a "thinking" block, so find the text block.
    // Also handle cases where the text block might contain explanation before the JSON array.
    const textBlock = response.content.find(block => block.type === 'text')
    if (textBlock) {
      // Try to extract JSON array from the response text (handles thinking blocks or explanatory text)
      const text = textBlock.text.trim()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      const jsonText = jsonMatch ? jsonMatch[0] : text

      // Robust JSON parsing with validation
      let experience: unknown
      try {
        experience = JSON.parse(jsonText)
      } catch (parseError) {
        console.warn('Failed to parse AI experience response as JSON, trying to extract manually:', parseError)
        // Try to manually extract experience from malformed JSON
        const objMatches = jsonText.match(/\{[\s\S]*?\}/g)
        if (objMatches) {
          try {
            experience = objMatches.map(m => JSON.parse(m))
          } catch {
            throw parseError
          }
        } else {
          throw parseError
        }
      }

      if (Array.isArray(experience)) {
        // Validate and normalize each experience object
        return experience
          .filter(e => e && typeof e === 'object')
          .map(e => {
            const exp = e as Record<string, unknown>
            return {
              role: String(exp.role || '').trim(),
              company: String(exp.company || '').trim(),
              duration: String(exp.duration || '').trim(),
              achievements: Array.isArray(exp.achievements)
                ? exp.achievements.map((a: unknown) => String(a).trim()).filter(Boolean)
                : []
            }
          })
          .filter(e => e.role)
      }
    }
  } catch (error) {
    console.error('AI experience extraction failed, falling back:', error)
  }

  return extractExperience(text) // Fallback
}

async function extractEducationWithAI(text: string): Promise<Array<{ degree: string; school: string; year: string }>> {
  // If no API key, use heuristic extraction
  if (!anthropic) {
    return extractEducation(text)
  }

  const prompt = `Extract education from this resume text. Return ONLY a JSON array of objects with these fields:
- degree: degree name (e.g., "Bachelor of Science in Computer Science")
- school: institution name
- year: graduation year

Resume text:
${text.slice(0, 8000)}

Return format: [{"degree": "...", "school": "...", "year": "..."}, ...]`

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 500,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    })

    // Local Claude proxies may prepend a "thinking" block, so find the text block.
    // Also handle cases where the text block might contain explanation before the JSON array.
    const textBlock = response.content.find(block => block.type === 'text')
    if (textBlock) {
      // Try to extract JSON array from the response text (handles thinking blocks or explanatory text)
      const text = textBlock.text.trim()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      const jsonText = jsonMatch ? jsonMatch[0] : text

      // Robust JSON parsing with validation
      let education: unknown
      try {
        education = JSON.parse(jsonText)
      } catch (parseError) {
        console.warn('Failed to parse AI education response as JSON, trying to extract manually:', parseError)
        // Try to manually extract education from malformed JSON
        const objMatches = jsonText.match(/\{[\s\S]*?\}/g)
        if (objMatches) {
          try {
            education = objMatches.map(m => JSON.parse(m))
          } catch {
            throw parseError
          }
        } else {
          throw parseError
        }
      }

      if (Array.isArray(education)) {
        // Validate and normalize each education object
        return education
          .filter(e => e && typeof e === 'object')
          .map(e => {
            const edu = e as Record<string, unknown>
            return {
              degree: String(edu.degree || '').trim(),
              school: String(edu.school || '').trim(),
              year: String(edu.year || '').trim()
            }
          })
          .filter(e => e.degree)
      }
    }
  } catch (error) {
    console.error('AI education extraction failed, falling back:', error)
  }

  return extractEducation(text) // Fallback
}

export async function parseResume(buffer: Buffer, fileName: string): Promise<ParsedResume> {
  let text = ''

  if (fileName.toLowerCase().endsWith('.pdf')) {
    const data = await pdfParse(buffer)
    text = data.text
  } else if (fileName.toLowerCase().endsWith('.docx')) {
    const result = await extractRawText({ buffer })
    text = result.value
  } else {
    text = buffer.toString('utf-8')
  }

  // Clean up text
  text = text.replace(/\s+/g, ' ').trim()

  // Use AI if available, otherwise use heuristic (both work great)
  const [skills, experience, education] = await Promise.all([
    extractSkillsWithAI(text),
    extractExperienceWithAI(text),
    extractEducationWithAI(text),
  ])

  const roleType = detectRoleType(skills, experience)

  // Generate title from first role or filename
  const title = experience[0]?.role || fileName.replace(/\.[^/.]+$/, '')

  return {
    title,
    roleType,
    text,
    skills,
    experience,
    education,
  }
}