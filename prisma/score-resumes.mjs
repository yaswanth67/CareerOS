import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Heuristic scoring function
const TECH_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB',
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Remix', 'Astro', 'HTML', 'CSS', 'Tailwind', 'Sass', 'Styled Components',
  'Node.js', 'Express', 'Fastify', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'ASP.NET', 'Rails', 'Laravel',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB', 'Cassandra', 'Elasticsearch', 'Prisma', 'TypeORM', 'Sequelize',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI',
  'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Hugging Face', 'Transformers', 'LangChain', 'LlamaIndex', 'OpenAI API',
  'MLOps', 'Kubeflow', 'MLflow', 'Weights & Biases',
  'Pandas', 'NumPy', 'Spark', 'Hadoop', 'Kafka', 'Airflow', 'dbt', 'Snowflake', 'BigQuery', 'Tableau', 'Power BI',
  'Git', 'Linux', 'GraphQL', 'REST', 'gRPC', 'WebSocket', 'Microservices', 'Serverless', 'CI/CD', 'Testing', 'TDD',
]

function extractSkills(text) {
  const foundSkills = new Set()
  for (const skill of TECH_SKILLS) {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(text)) {
      foundSkills.add(skill)
    }
  }
  return Array.from(foundSkills)
}

function parseJsonArray(str) {
  if (!str) return []
  try {
    return JSON.parse(str)
  } catch {
    return []
  }
}

function stringifyJsonArray(arr) {
  return JSON.stringify(arr || [])
}

const LEVEL_ORDER = ['ENTRY', 'MID', 'SENIOR', 'STAFF']

function inferCandidateLevel(resumeText) {
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

function calculateRoleAlignment(resumeText, jobRoleType) {
  const roleKeywords = {
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
    SDE: ['software', 'engineer', 'developer', 'programming', 'coding', 'algorithm', 'data structure'],
  }

  const keywords = roleKeywords[jobRoleType] || []
  if (keywords.length === 0) return 50

  const matches = keywords.filter(kw => resumeText.includes(kw.toLowerCase())).length
  return Math.min(100, (matches / keywords.length) * 120)
}

function calculateLevelMatch(resumeText, jobLevel) {
  const candidate = inferCandidateLevel(resumeText)
  const jobIndex = LEVEL_ORDER.indexOf(jobLevel)
  if (jobIndex === -1) return 50

  const distance = jobIndex - LEVEL_ORDER.indexOf(candidate)
  if (distance === 0) return 100
  if (distance === 1) return 55
  if (distance >= 2) return 10
  if (distance === -1) return 70
  return 45
}

function levelReachPenalty(resumeText, jobLevel) {
  const jobIndex = LEVEL_ORDER.indexOf(jobLevel)
  if (jobIndex === -1) return 1
  const distance = jobIndex - LEVEL_ORDER.indexOf(inferCandidateLevel(resumeText))
  if (distance <= 0) return 1
  if (distance === 1) return 0.9
  if (distance === 2) return 0.75
  return 0.6
}

function heuristicScore(resumeText, resumeSkills, job) {
  const resumeSkillSet = new Set(resumeSkills.map(s => s.toLowerCase()))
  const resumeTextLower = resumeText.toLowerCase()
  const jobDescLower = job.description.toLowerCase()

  // 1. Skill Overlap (40% weight)
  const matchedSkills = job.skills.filter(s => resumeSkillSet.has(s.toLowerCase()))
  const missingSkills = job.skills.filter(s => !resumeSkillSet.has(s.toLowerCase()))
  const skillScore = job.skills.length > 0
    ? (matchedSkills.length / job.skills.length) * 100
    : 50

  // 2. Experience Relevance (25% weight)
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

  // Weighted composite
  const weighted =
    skillScore * 0.40 +
    experienceScore * 0.25 +
    roleTypeScore * 0.20 +
    levelScore * 0.15

  // Apply level penalty
  const finalScore = Math.round(weighted * levelReachPenalty(resumeTextLower, job.experienceLevel))

  // Generate reasoning
  const skillPct = job.skills.length > 0 ? Math.round((matchedSkills.length / job.skills.length) * 100) : 0
  const roleLabel = job.roleType.replace(/_/g, ' ')
  const levelLabel = job.experienceLevel

  let reasoning = `Skill match: ${matchedSkills.length}/${job.skills.length} (${skillPct}%) required skills. `
  reasoning += `Role alignment with ${roleLabel}: ${roleTypeScore > 60 ? 'strong' : roleTypeScore > 30 ? 'moderate' : 'weak'}. `

  if (levelScore >= 100) reasoning += `Seniority (${levelLabel}): matches your level.`
  else if (levelScore >= 70) reasoning += `Seniority (${levelLabel}): below your level.`
  else if (levelScore >= 55) reasoning += `Seniority (${levelLabel}): one level up — a stretch.`
  else if (levelScore <= 10) reasoning += `Seniority (${levelLabel}): well above your level.`
  else reasoning += `Seniority (${levelLabel}): partial match.`

  function getRecommendation(score) {
    if (score >= 80) return 'STRONG_MATCH'
    if (score >= 60) return 'GOOD_MATCH'
    if (score >= 40) return 'WEAK_MATCH'
    return 'NO_MATCH'
  }

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    reasoning,
    matchedSkills,
    missingSkills,
    recommendation: getRecommendation(finalScore),
  }
}

async function main() {
  const userId = 'cmspn3dic00004qjlzjepkc94'

  // Get all resumes for user
  const resumes = await prisma.resume.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })

  console.log(`Found ${resumes.length} resumes`)

  // Get all active US jobs
  const jobs = await prisma.job.findMany({
    where: {
      isActive: true,
      isUs: true,
    },
    orderBy: { postedAt: 'desc' },
  })

  console.log(`Found ${jobs.length} active US jobs`)

  let totalScored = 0

  for (const resume of resumes) {
    console.log(`\nScoring resume: ${resume.title} (${resume.roleType})`)

    // Get jobs that don't have a match for this resume yet
    const existingMatchJobIds = await prisma.match.findMany({
      where: { resumeId: resume.id },
      select: { jobId: true },
    })
    const existingMatchSet = new Set(existingMatchJobIds.map(m => m.jobId))

    const unscoredJobs = jobs.filter(job => !existingMatchSet.has(job.id))
    console.log(`  ${unscoredJobs.length} new jobs to score (${existingMatchSet.size} already scored)`)

    if (unscoredJobs.length === 0) continue

    const resumeSkills = parseJsonArray(resume.skills) || []
    const resumeText = resume.parsedText

    const rows = []
    for (const job of unscoredJobs) {
      const jobSkills = parseJsonArray(job.skills) || []
      const result = heuristicScore(resumeText, resumeSkills, {
        ...job,
        skills: jobSkills,
      })

      rows.push({
        jobId: job.id,
        resumeId: resume.id,
        score: result.score,
        reasoning: result.reasoning,
        matchedSkills: stringifyJsonArray(result.matchedSkills),
        missingSkills: stringifyJsonArray(result.missingSkills),
      })
    }

    // Insert in chunks
    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      await prisma.match.createMany({ data: rows.slice(i, i + CHUNK) })
    }

    console.log(`  Created ${rows.length} matches`)
    totalScored += rows.length
  }

  console.log(`\nTotal matches created: ${totalScored}`)

  // Verify
  const counts = await prisma.resume.findMany({
    where: { userId },
    include: { _count: { select: { matches: true } } },
  })

  for (const r of counts) {
    console.log(`  ${r.title}: ${r._count.matches} matches`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())