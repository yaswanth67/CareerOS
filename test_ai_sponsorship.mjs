import { classifySponsorshipForJobs } from './src/lib/job-fetcher/sponsorship.ts';

console.log('Testing AI sponsorship classification...');
const result = await classifySponsorshipForJobs({ limit: 10, batchSize: 5 });
console.log('Classified:', result);