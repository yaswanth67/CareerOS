import { classifyBatchWithAI } from './src/lib/job-fetcher/sponsorship.ts';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Test with explicit jobs that have clear sponsorship text
  const testJobs = [
    {
      id: 'test1',
      title: 'Software Engineer',
      company: 'Test Company',
      description: 'We are looking for a software engineer. We will sponsor H-1B visas for qualified candidates.'
    },
    {
      id: 'test2',
      title: 'DevOps Engineer',
      company: 'Another Corp',
      description: 'We do not provide visa sponsorship. Candidates must have work authorization.'
    }
  ];

  console.log('Testing AI classification on clear test jobs...');
  const result = await classifyBatchWithAI(testJobs);
  console.log('Result:', result);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });