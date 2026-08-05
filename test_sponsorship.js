const { detectSponsorshipKeyword } = require('../src/lib/job-fetcher/sponsorship.ts');

const testCases = [
  'We will sponsor H-1B visas for qualified candidates',
  'We do not provide visa sponsorship',
  'We are unable to offer visa sponsorship',
  'Sponsorship is available for this role',
  'We will sponsor work visas',
  'No visa sponsorship provided',
  'Join our team to build scalable systems that impact billions of users',
  'Scale our deployment platform to serve millions of developers',
  'div class= content-intro p span style= font-family: helvetica, arial, sans-serif; font-size: 12pt; Airbnb was born in 2007',
];

testCases.forEach(tc => {
  const result = detectSponsorshipKeyword(tc);
  console.log('Result:', result, '| Text:', tc.slice(0, 80));
});