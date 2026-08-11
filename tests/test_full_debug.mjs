import { classifySponsorshipForJobs } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check jobs that should go to AI (no keyword match)
  const jobs = await prisma.job.findMany({
    where: { isActive: true, visaSponsored: null },
    select: { id: true, title: true, company: true, description: true },
    take: 10,
  });

  console.log('Testing keyword detection on 10 unclassified jobs:');
  const { detectSponsorshipKeyword } = await import('./src/lib/job-fetcher/sponsorship.ts');

  for (const job of jobs) {
    const text = `${job.title} ${job.company} ${job.description || ''}`;
    const result = detectSponsorshipKeyword(text);
    console.log('  Result:', result, '|', job.title, '|', job.company);
  }

  // Now test AI classification
  console.log('\\nRunning AI classification...');
  const result = await classifySponsorshipForJobs({ limit: 10, batchSize: 5 });
  console.log('Classified:', result);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });