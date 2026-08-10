import { classifySponsorshipForJobs } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // First check pending jobs that have sponsorship keywords
  const jobs = await prisma.job.findMany({
    where: { isActive: true, visaSponsored: null },
    select: { id: true, title: true, company: true, description: true },
    take: 50,
  });

  console.log('Checking 50 jobs for sponsorship keywords...');
  let withKeywords = 0;
  for (const job of jobs) {
    const text = `${job.title} ${job.company} ${job.description || ''}`.toLowerCase();
    if (text.includes('sponsor') || text.includes('h-1b') || text.includes('h1b') || text.includes('visa')) {
      console.log('  Found:', job.title, '|', job.company);
      withKeywords++;
    }
  }
  console.log('Jobs with sponsorship keywords:', withKeywords);

  // Now test AI classification
  console.log('\\nTesting AI classification on these...');
  const result = await classifySponsorshipForJobs({ limit: 50, batchSize: 10 });
  console.log('Classified:', result);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });