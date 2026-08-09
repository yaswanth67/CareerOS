import { classifyBatchWithAI } from './src/lib/job-fetcher/sponsorship.ts';

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
  },
  {
    id: 'test3',
    title: 'Frontend Engineer',
    company: 'Third Inc',
    description: 'Build amazing frontend applications with React and TypeScript. No sponsorship mentioned.'
  }
];

console.log('Testing AI batch classification...');
const result = await classifyBatchWithAI(testJobs);
console.log('Result:', result);