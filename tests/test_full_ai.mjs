import { classifySponsorshipForJobs } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing full classifySponsorshipForJobs with AI...');

  // Check the first 20 unclassified jobs - most won't have keywords
  const jobs = await prisma.job.findMany({
    where: { isActive: true, visaSponsored: null },
    select: { id: true, title: true, company: true, description: true },
    take: 20,
  });

  console.log('First 20 unclassified jobs:');
  jobs.forEach((j, i) => {
    const text = `${j.title} ${j.company} ${j.description || ''}`.toLowerCase();
    const hasKeywords = text.includes('sponsor') || text.includes('h-1b') || text.includes('h1b') || text.includes('visa');
    console.log(`  ${i+1}. ${j.title} | ${j.company} | hasKeywords: ${hasKeywords}`);
  });

  // Now test with a larger limit to see if AI gets called
  console.log('\\nRunning classifySponsorshipForJobs with limit=20...');
  const result = await classifySponsorshipForJobs({ limit: 20, batchSize: 10 });
  console.log('Classified:', result);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });