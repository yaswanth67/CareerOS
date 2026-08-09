import { detectSponsorshipKeyword } from './src/lib/job-fetcher/sponsorship.ts';

const text = 'visa sponsorship: we do sponsor visas! however, we aren t able to successfully sponsor visas for every role and every candidate. but if we make you an offer, we will make every reasonable effort to get you a visa';

console.log('Keyword result:', detectSponsorshipKeyword(text));