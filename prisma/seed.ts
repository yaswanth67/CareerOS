import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { normalizeCompany } from '../src/lib/job-fetcher/normalize-company'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create test user
  const passwordHash = await bcrypt.hash('qwerty@1', 12)

  const user = await prisma.user.upsert({
    where: { name: 'buddy' },
    update: { email: 'buddy@gmail.com' },
    create: {
      name: 'buddy',
      email: 'buddy@gmail.com',
      passwordHash,
    },
  })

  console.log('Created user:', user.name)

  // Create preferences
  await prisma.preference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      targetRoles: JSON.stringify(['SDE', 'AI_ENGINEER', 'FULLSTACK']),
      locations: JSON.stringify(['San Francisco', 'New York', 'Remote']),
      remoteOnly: false,
      visaRequired: false,
      minSalary: 100000,
      excludedKeywords: JSON.stringify(['senior', 'lead', 'principal', 'manager']),
    },
  })

  console.log('Created preferences')

  // Create sample resumes
  const sdeResume = await prisma.resume.create({
    data: {
      userId: user.id,
      title: 'Software Engineer Resume',
      roleType: 'SDE',
      fileName: 'sde_resume.pdf',
      filePath: '/uploads/sde_resume.pdf',
      parsedText: `Software Engineer with 2 years of experience building scalable web applications.

EXPERIENCE:
Software Engineer Intern at Google (Jun 2023 - Sep 2023)
• Built distributed systems using Java and Go
• Worked on Kubernetes orchestration
• Improved API latency by 40%

Software Engineer at StartupXYZ (Jun 2022 - May 2023)
• Developed React/TypeScript frontend
• Built Node.js/PostgreSQL backend
• Implemented CI/CD pipelines

EDUCATION:
BS Computer Science, Stanford University (2022)

SKILLS:
Java, Go, Python, JavaScript, TypeScript, React, Node.js, PostgreSQL, Kubernetes, Docker, AWS, Git`,
      skills: JSON.stringify(['Java', 'Go', 'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Kubernetes', 'Docker', 'AWS', 'Git']),
      experience: JSON.stringify([
        { role: 'Software Engineer Intern', company: 'Google', duration: 'Jun 2023 - Sep 2023', achievements: ['Built distributed systems using Java and Go', 'Worked on Kubernetes orchestration', 'Improved API latency by 40%'] },
        { role: 'Software Engineer', company: 'StartupXYZ', duration: 'Jun 2022 - May 2023', achievements: ['Developed React/TypeScript frontend', 'Built Node.js/PostgreSQL backend', 'Implemented CI/CD pipelines'] },
      ]),
      education: JSON.stringify([
        { degree: 'BS Computer Science', school: 'Stanford University', year: '2022' },
      ]),
    },
  })

  const aiResume = await prisma.resume.create({
    data: {
      userId: user.id,
      title: 'AI Engineer Resume',
      roleType: 'AI_ENGINEER',
      fileName: 'ai_resume.pdf',
      filePath: '/uploads/ai_resume.pdf',
      parsedText: `AI/ML Engineer with focus on LLMs and production ML systems.

EXPERIENCE:
ML Engineer Intern at OpenAI (Jan 2023 - Jun 2023)
• Fine-tuned GPT models for specific tasks
• Built evaluation pipelines for LLM outputs
• Worked with PyTorch and Transformers library

Research Assistant at Stanford AI Lab (Sep 2021 - Dec 2022)
• Published paper on efficient transformer architectures
• Implemented custom CUDA kernels for attention
• Experimented with LoRA and quantization techniques

EDUCATION:
MS Computer Science (AI Focus), Stanford University (2023)
BS Computer Science, UC Berkeley (2021)

SKILLS:
Python, PyTorch, TensorFlow, Transformers, LangChain, LlamaIndex, CUDA, Kubernetes, Docker, AWS, MLflow, Weights & Biases`,
      skills: JSON.stringify(['Python', 'PyTorch', 'TensorFlow', 'Transformers', 'LangChain', 'LlamaIndex', 'CUDA', 'Kubernetes', 'Docker', 'AWS', 'MLflow', 'Weights & Biases']),
      experience: JSON.stringify([
        { role: 'ML Engineer Intern', company: 'OpenAI', duration: 'Jan 2023 - Jun 2023', achievements: ['Fine-tuned GPT models for specific tasks', 'Built evaluation pipelines for LLM outputs', 'Worked with PyTorch and Transformers library'] },
        { role: 'Research Assistant', company: 'Stanford AI Lab', duration: 'Sep 2021 - Dec 2022', achievements: ['Published paper on efficient transformer architectures', 'Implemented custom CUDA kernels for attention', 'Experimented with LoRA and quantization techniques'] },
      ]),
      education: JSON.stringify([
        { degree: 'MS Computer Science (AI Focus)', school: 'Stanford University', year: '2023' },
        { degree: 'BS Computer Science', school: 'UC Berkeley', year: '2021' },
      ]),
    },
  })

  console.log('Created sample resumes')

  // Create sample jobs
  const sampleJobs = [
    {
      externalId: 'google-swe-001',
      provider: 'COMPANY_DIRECT',
      title: 'Software Engineer - New Grad',
      company: 'Google',
      location: 'Mountain View, CA',
      isRemote: false,
      description: 'Join our team to build scalable systems that impact billions of users. You will work on distributed systems, storage, and infrastructure.',
      requirements: JSON.stringify(['Strong coding skills in Java, C++, or Go', 'Experience with distributed systems', 'Knowledge of data structures and algorithms']),
      skills: JSON.stringify(['Java', 'Go', 'Python', 'Distributed Systems', 'Kubernetes', 'Linux']),
      experienceLevel: 'ENTRY',
      roleType: 'SDE',
      salaryMin: 120000,
      salaryMax: 180000,
      currency: 'USD',
      applyUrl: 'https://careers.google.com/jobs/results/software-engineer-new-grad',
      postedAt: new Date(Date.now() - 2 * 3600000),
      isActive: true,
    },
    {
      externalId: 'openai-ai-001',
      provider: 'GREENHOUSE',
      title: 'AI Engineer',
      company: 'OpenAI',
      location: 'San Francisco, CA',
      isRemote: false,
      description: 'Work on cutting-edge AI models and help shape the future of artificial intelligence. Experience with LLMs and production ML systems required.',
      requirements: JSON.stringify(['Strong Python and PyTorch skills', 'Experience with Transformer architectures', 'Knowledge of LLM training and fine-tuning']),
      skills: JSON.stringify(['Python', 'PyTorch', 'Transformers', 'LLMs', 'MLOps', 'Kubernetes']),
      experienceLevel: 'ENTRY',
      roleType: 'AI_ENGINEER',
      salaryMin: 150000,
      salaryMax: 250000,
      currency: 'USD',
      applyUrl: 'https://boards.greenhouse.io/openai',
      postedAt: new Date(Date.now() - 5 * 3600000),
      isActive: true,
    },
    {
      externalId: 'stripe-fs-001',
      provider: 'LEVER',
      title: 'Full Stack Developer',
      company: 'Stripe',
      location: 'San Francisco, CA',
      isRemote: true,
      description: 'Build financial infrastructure for the internet. Work across the stack from React frontend to Ruby/Go backend services.',
      requirements: JSON.stringify(['TypeScript and React expertise', 'Backend experience with Ruby, Go, or Node.js', 'Database design and optimization']),
      skills: JSON.stringify(['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Ruby', 'Go']),
      experienceLevel: 'ENTRY',
      roleType: 'FULLSTACK',
      salaryMin: 130000,
      salaryMax: 200000,
      currency: 'USD',
      applyUrl: 'https://jobs.lever.co/stripe',
      postedAt: new Date(Date.now() - 24 * 3600000),
      isActive: true,
    },
    {
      externalId: 'vercel-devops-001',
      provider: 'WELLFOUND',
      title: 'DevOps Engineer',
      company: 'Vercel',
      location: 'Remote',
      isRemote: true,
      description: 'Scale our deployment platform to serve millions of developers. Build and maintain Kubernetes infrastructure.',
      requirements: JSON.stringify(['Deep Kubernetes experience', 'Infrastructure as Code with Terraform', 'AWS/GCP expertise']),
      skills: JSON.stringify(['Kubernetes', 'Docker', 'AWS', 'Terraform', 'Go', 'Prometheus', 'Grafana']),
      experienceLevel: 'MID',
      roleType: 'DEVOPS',
      salaryMin: 140000,
      salaryMax: 220000,
      currency: 'USD',
      applyUrl: 'https://vercel.com/careers/devops-engineer',
      postedAt: new Date(Date.now() - 48 * 3600000),
      isActive: true,
    },
    {
      externalId: 'meta-swe-001',
      provider: 'COMPANY_DIRECT',
      title: 'Software Engineer - Frontend',
      company: 'Meta',
      location: 'Menlo Park, CA',
      isRemote: false,
      description: 'Build the next generation of social experiences. Work on React, React Native, and internal tools.',
      requirements: JSON.stringify(['Expert in React and TypeScript', 'Experience with React Native', 'Performance optimization skills']),
      skills: JSON.stringify(['React', 'TypeScript', 'React Native', 'GraphQL', 'Jest', 'Webpack']),
      experienceLevel: 'ENTRY',
      roleType: 'FRONTEND',
      salaryMin: 135000,
      salaryMax: 200000,
      currency: 'USD',
      applyUrl: 'https://www.metacareers.com/jobs/software-engineer-frontend',
      postedAt: new Date(Date.now() - 12 * 3600000),
      isActive: true,
    },
    {
      externalId: 'anthropic-ml-001',
      provider: 'GREENHOUSE',
      title: 'ML Research Engineer',
      company: 'Anthropic',
      location: 'San Francisco, CA',
      isRemote: false,
      description: 'Conduct research on AI safety and alignment. Publish papers and build safe AI systems.',
      requirements: JSON.stringify(['PhD or equivalent research experience', 'Deep learning expertise', 'Publications at top ML conferences']),
      skills: JSON.stringify(['Python', 'PyTorch', 'JAX', 'Transformers', 'RLHF', 'Constitutional AI', 'Research']),
      experienceLevel: 'SENIOR',
      roleType: 'ML_ENGINEER',
      salaryMin: 200000,
      salaryMax: 400000,
      currency: 'USD',
      applyUrl: 'https://boards.greenhouse.io/anthropic/jobs/ml-research-engineer',
      postedAt: new Date(Date.now() - 72 * 3600000),
      isActive: true,
    },
    {
      externalId: 'netflix-data-001',
      provider: 'LEVER',
      title: 'Data Engineer',
      company: 'Netflix',
      location: 'Los Gatos, CA',
      isRemote: true,
      description: 'Build data pipelines that power personalization for 200M+ members. Work with Spark, Flink, and custom infrastructure.',
      requirements: JSON.stringify(['Strong Java/Scala and SQL', 'Experience with Spark/Flink', 'Data modeling and warehouse design']),
      skills: JSON.stringify(['Java', 'Scala', 'SQL', 'Spark', 'Flink', 'Kafka', 'Airflow', 'dbt', 'Snowflake']),
      experienceLevel: 'MID',
      roleType: 'DATA_ENGINEER',
      salaryMin: 150000,
      salaryMax: 250000,
      currency: 'USD',
      applyUrl: 'https://jobs.lever.co/netflix',
      postedAt: new Date(Date.now() - 36 * 3600000),
      isActive: true,
    },
  ]

  for (const job of sampleJobs) {
    // companySlug is what deduplication matches on — see src/lib/job-fetcher/dedup.ts
    const data = { ...job, companySlug: normalizeCompany(job.company) }
    await prisma.job.upsert({
      where: {
        externalId_provider: {
          externalId: job.externalId,
          provider: job.provider,
        },
      },
      update: data,
      create: data,
    })
  }

  console.log('Created sample jobs')

  // Create sample matches
  const matches = [
    { jobId: sampleJobs[0].externalId, resumeId: sdeResume.id, score: 92, reasoning: 'Excellent match! Your Java/Go experience and distributed systems background align perfectly.', matchedSkills: JSON.stringify(['Java', 'Go', 'Distributed Systems', 'Kubernetes']), missingSkills: JSON.stringify([]) },
    { jobId: sampleJobs[1].externalId, resumeId: aiResume.id, score: 88, reasoning: 'Strong match! Your PyTorch, Transformers, and LLM experience directly matches requirements.', matchedSkills: JSON.stringify(['Python', 'PyTorch', 'Transformers', 'LLMs', 'MLOps']), missingSkills: JSON.stringify([]) },
    { jobId: sampleJobs[2].externalId, resumeId: sdeResume.id, score: 85, reasoning: 'Great match! Your TypeScript, React, and Node.js skills are exactly what Stripe needs.', matchedSkills: JSON.stringify(['TypeScript', 'React', 'Node.js', 'PostgreSQL']), missingSkills: JSON.stringify(['AWS', 'Ruby', 'Go']) },
    { jobId: sampleJobs[3].externalId, resumeId: sdeResume.id, score: 45, reasoning: 'Weak match. Missing core DevOps skills like Kubernetes, Terraform, and AWS.', matchedSkills: JSON.stringify(['Docker', 'Go']), missingSkills: JSON.stringify(['Kubernetes', 'AWS', 'Terraform', 'Prometheus']) },
    { jobId: sampleJobs[4].externalId, resumeId: sdeResume.id, score: 78, reasoning: 'Good match! Strong React/TypeScript skills, but limited React Native experience.', matchedSkills: JSON.stringify(['React', 'TypeScript', 'GraphQL']), missingSkills: JSON.stringify(['React Native', 'Jest']) },
    { jobId: sampleJobs[5].externalId, resumeId: aiResume.id, score: 35, reasoning: 'Poor match. Requires PhD-level research experience and publications.', matchedSkills: JSON.stringify(['Python', 'PyTorch', 'Transformers']), missingSkills: JSON.stringify(['JAX', 'RLHF', 'Constitutional AI', 'Research Publications']) },
    { jobId: sampleJobs[6].externalId, resumeId: sdeResume.id, score: 55, reasoning: 'Moderate match. Some Java/SQL overlap but missing Scala, Spark, Flink expertise.', matchedSkills: JSON.stringify(['Java', 'SQL']), missingSkills: JSON.stringify(['Scala', 'Spark', 'Flink', 'Kafka', 'Airflow', 'dbt']) },
  ]

  for (const match of matches) {
    const job = await prisma.job.findUnique({
      where: { externalId_provider: { externalId: match.jobId, provider: sampleJobs.find(j => j.externalId === match.jobId)?.provider || 'COMPANY_DIRECT' } },
    })
    if (job) {
      await prisma.match.upsert({
        where: { jobId_resumeId: { jobId: job.id, resumeId: match.resumeId } },
        update: match,
        create: { ...match, jobId: job.id },
      })
    }
  }

  console.log('Created sample matches')

  // Create sample applications (idempotent)
  const sampleApplications = [
    {
      externalId: 'google-swe-001',
      provider: 'COMPANY_DIRECT',
      status: 'APPLIED',
      appliedAt: new Date(Date.now() - 3 * 24 * 3600000),
      notes: 'Applied via referral. Recruiter reached out for phone screen.',
    },
    {
      externalId: 'stripe-fs-001',
      provider: 'LEVER',
      status: 'INTERVIEWING',
      appliedAt: new Date(Date.now() - 7 * 24 * 3600000),
      notes: 'Phone screen completed. Onsite scheduled for next week.',
    },
  ]

  for (const app of sampleApplications) {
    const job = await prisma.job.findUnique({
      where: { externalId_provider: { externalId: app.externalId, provider: app.provider } },
    })
    if (!job) continue
    await prisma.application.upsert({
      where: { userId_jobId: { userId: user.id, jobId: job.id } },
      update: { resumeId: sdeResume.id, status: app.status, notes: app.notes },
      create: {
        userId: user.id,
        jobId: job.id,
        resumeId: sdeResume.id,
        status: app.status,
        appliedAt: app.appliedAt,
        notes: app.notes,
      },
    })
  }

  console.log('Created sample applications')
  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })