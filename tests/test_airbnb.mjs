import { detectSponsorshipKeyword } from './src/lib/job-fetcher/sponsorship.ts';

// Test the exact Airbnb text that we know has "sponsor" in it
const text = 'associate counsel, innovation and thought leadership airbnb div class= content-intro p span style= font-family: helvetica, arial, sans-serif; font-size: 12pt; airbnb was born in 2007 when two hosts welcomed three guests to their san francisco home, and has since grown to over 5 million hosts who have welcomed over 2 billion guest arrivals in almost every country across the globe. every day, hosts offer unique stays and experiences that make it possible for guests to connect with communities in a';
console.log('Test 1 - Airbnb text:', detectSponsorshipKeyword(text));

// Test a positive case
const text2 = 'we will sponsor h-1b visa for this role';
console.log('Test 2 - we will sponsor:', detectSponsorshipKeyword(text2));

// Test with "sponsor" keyword
const text3 = 'this company will sponsor visas';
console.log('Test 3 - sponsor visas:', detectSponsorshipKeyword(text3));

// Test negative
const text4 = 'we do not provide visa sponsorship';
console.log('Test 4 - do not provide:', detectSponsorshipKeyword(text4));