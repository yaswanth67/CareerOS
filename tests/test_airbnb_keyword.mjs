import { classifySponsorshipForJobs } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get the airbnb job with sponsorship keywords
  const job = await prisma.job.findFirst({
    where: { isActive: true, visaSponsored: null, title: { contains: 'Associate Counsel' } },
    select: { id: true, title: true, company: true, description: true },
  });

  if (job) {
    const text = `${job.title} ${job.company} ${job.description || ''}`;
    console.log('Full text length:', text.length);
    console.log('Text around sponsor:');
    const lower = text.toLowerCase();
    let pos = lower.indexOf('sponsor');
    while (pos !== -1) {
      console.log('  ', text.slice(Math.max(0, pos-100), pos+100));
      pos = lower.indexOf('sponsor', pos + 1);
    }
  }

  // Now check keyword detection
  const { detectSponsorshipKeyword } = await import('./src/lib/job-fetcher/sponsorship.ts');
  const text = `${job.title} ${job.company} ${job.description || ''}`;
  console.log('\\nKeyword result:', detectSponsorshipKeyword(text));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });