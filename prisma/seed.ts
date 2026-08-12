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

  // No sample resumes — the Resumes page should only show real user uploads.
  // (Sample jobs below still populate the feed; matches are scored after the
  // user uploads their own resume.) Also remove dummy resumes an older version
  // of this script created, so re-seeding actually clears them. Matches and
  // applications referencing them are removed via cascade.
  await prisma.resume.deleteMany({
    where: {
      userId: user.id,
      filePath: { in: ['/uploads/sde_resume.pdf', '/uploads/ai_resume.pdf'] },
    },
  })

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

  // No sample matches or applications — both require a real resume (the match
  // key is jobId + resumeId), and dummy ones would fake the tracking data.

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