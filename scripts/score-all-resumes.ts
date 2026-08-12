import { prisma } from '@/lib/db'
import { autoScoreUserJobs } from '@/lib/job-fetcher/auto-score'

async function main() {
  const userId = 'cmspn3dic00004qjlzjepkc94'
  console.log('Scoring all resumes for user:', userId)
  const scored = await autoScoreUserJobs(userId)
  console.log('Scored:', scored, 'matches')
}

main().catch(console.error).finally(() => prisma.$disconnect())