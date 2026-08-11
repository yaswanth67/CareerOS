import { classifyBatchWithAI } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.job.findMany({
    where: { isActive: true, visaSponsored: null },
    select: { id: true, title: true, company: true, description: true },
    take: 50,
  });

  const candidates = [];
  for (const job of jobs) {
    const text = `${job.title} ${job.company} ${job.description || ''}`.toLowerCase();
    if (text.includes('sponsor') || text.includes('h-1b') || text.includes('h1b') || text.includes('visa')) {
      candidates.push(job);
      console.log('Candidate:', job.title, '|', job.company);
      console.log('Text:', text.slice(0, 500));
    }
  }

  console.log('\\nFound', candidates.length, 'jobs with sponsorship keywords');

  if (candidates.length > 0) {
    console.log('\\nTesting AI classification...');
    const result = await classifyBatchWithAI(candidates);
    console.log('Result:', result);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });