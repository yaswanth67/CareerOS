import { classifySponsorshipForJobs } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // First check pending jobs
  const pending = await prisma.job.findMany({
    where: { isActive: true, visaSponsored: null },
    select: { id: true, title: true, company: true, description: true },
    take: 5,
  });

  console.log('Pending jobs:');
  pending.forEach(j => console.log('  ', j.id, j.title, j.company, 'desc len:', (j.description || '').length));

  // Check keyword detection
  const { detectSponsorshipKeyword } = await import('./src/lib/job-fetcher/sponsorship.ts');
  for (const job of pending) {
    const text = `${job.title} ${job.company} ${job.description || ''}`;
    const result = detectSponsorshipKeyword(text);
    console.log('Keyword result:', result, '|', job.title);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });