import { classifySponsorshipForJobs } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Test with limit large enough to include the airbnb job and some others
  // First, let's find out what the total pending count is
  const pendingCount = await prisma.job.count({ where: { isActive: true, visaSponsored: null } });
  console.log('Total pending jobs:', pendingCount);

  // Check how many have sponsorship keywords
  const jobs = await prisma.job.findMany({
    where: { isActive: true, visaSponsored: null },
    select: { id: true, title: true, company: true, description: true },
    take: 200,
  });

  let keywordCount = 0;
  const { detectSponsorshipKeyword } = await import('./src/lib/job-fetcher/sponsorship.ts');
  for (const job of jobs) {
    const text = `${job.title} ${job.company} ${job.description || ''}`;
    const result = detectSponsorshipKeyword(text);
    if (result !== null) {
      keywordCount++;
      console.log('Keyword match:', result, '|', job.title, '|', job.company);
    }
  }
  console.log('\\nKeyword matches in first 200:', keywordCount);

  // Now test AI on the remaining (limit=50, keywordOnly=false)
  console.log('\\nRunning AI classification on limit=50...');
  const result = await classifySponsorshipForJobs({ limit: 50, batchSize: 10 });
  console.log('Classified:', result);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });