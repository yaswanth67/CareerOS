/**
 * us-location.test.mjs — regression tests for the US-only job gate.
 *
 * Locks in the precedence rules in src/lib/geo/us-location.ts, especially the
 * two-letter code collisions that make naive country detection wrong:
 * CA is California *and* Canada, IN is Indiana *and* India, DE is Delaware
 * *and* Germany. Every case below is a real location string taken from the
 * job table, so a regression here means bad jobs reach the feed.
 *
 * Run: npx tsx tests/us-location.test.mjs
 */

import { classifyUsLocation, classifyUsJob, isUsJob } from '../src/lib/geo/us-location.ts'

let passed = 0
let failed = 0

function check(input, expected, note = '') {
  const actual = classifyUsLocation(input)
  if (actual === expected) {
    passed++
  } else {
    failed++
    console.error(`  FAIL ${JSON.stringify(input)} -> ${actual}, expected ${expected}${note ? ` (${note})` : ''}`)
  }
}

function checkJob(job, expected, note = '') {
  const actual = classifyUsJob(job)
  if (actual === expected) {
    passed++
  } else {
    failed++
    console.error(`  FAIL ${JSON.stringify(job)} -> ${actual}, expected ${expected}${note ? ` (${note})` : ''}`)
  }
}

console.log('US locations')
check('United States', 'US')
check('USA', 'US')
check('Remote - USA', 'US')
check('Remote - US', 'US')
check('Remote U.S.', 'US')
check('US - Remote', 'US')
check('Remote - US: Select locations', 'US', 'colon must not stick to the token')
check('US, WA, Seattle', 'US', 'Amazon shape')
check('US-CA-Menlo Park', 'US', 'Meta shape')
check('San Francisco, CA', 'US')
check('San Francisco', 'US')
check('New York, NY (HQ)', 'US')
check('New York City', 'US', "must not match York, UK")
check('New York City Office', 'US')
check('Washington, DC', 'US')
check('Washington, D.C.', 'US', 'periods stripped')
check('Hawthorne, CA', 'US')
check('Bastrop, TX', 'US')
check('Starbase, TX', 'US')
check('Mountain View, California', 'US')
check('Cape Canaveral, FL', 'US')
check('San Francisco, CA • New York, NY • United States', 'US')
check('San Francisco, CA | New York City, NY | Seattle, WA', 'US')
check('Boston, Massachusetts, USA; New York, New York, USA', 'US')
check('Oakland, California, United States, AMER', 'US', 'explicit US beats the AMER region')

console.log('US state codes that collide with country codes')
check('Wilmington, DE', 'US', 'DE is Delaware, not Germany')
check('Indianapolis, IN', 'US', 'IN is Indiana, not India')
check('Philadelphia, PA', 'US', 'PA is Pennsylvania, not Panama')
check('Nashville, TN', 'US', 'TN is Tennessee, not Tunisia')
check('Springfield, IL', 'US', 'IL is Illinois, not Israel')
check('Boise, ID', 'US', 'ID is Idaho, not Indonesia')
check('Boston, MA', 'US', 'MA is Massachusetts, not Morocco')

console.log('US namesakes of foreign cities')
check('Dublin, OH', 'US')
check('Vancouver, WA', 'US')
check('Manchester, NH', 'US')
check('Birmingham, AL', 'US')
check('Cambridge, MA', 'US')
check('San Jose, CA', 'US', 'not San Jose, Costa Rica')
check('Ontario, CA', 'US', 'Ontario, California')

console.log('Non-US locations')
check('London', 'NON_US')
check('London, UK', 'NON_US')
check('Singapore', 'NON_US')
check('Bengaluru, India', 'NON_US')
check('Tokyo, Japan', 'NON_US')
check('Berlin', 'NON_US')
check('Dublin, Ireland', 'NON_US')
check('Dublin', 'NON_US', 'bare Dublin is Ireland in these feeds')
check('Dublin, IE', 'NON_US')
check('Sydney, Australia', 'NON_US')
check('Toronto, Canada', 'NON_US')
check('Toronto, CA', 'NON_US', 'CA here is Canada, resolved by the city')
check('Toronto', 'NON_US')
check('Vancouver, BC', 'NON_US')
check('Remote - India', 'NON_US')
check('Remote - Canada', 'NON_US')
check('IN, KA, Bengaluru', 'NON_US')
check('JP, 13, Tokyo', 'NON_US')
check('BR, SP, Cajamar', 'NON_US')
check('MX, Cdmx', 'NON_US')
check('GB-London', 'NON_US')
check('PL-Warsaw-Lixa C', 'NON_US')
check('AU-Victoria-Remote', 'NON_US')
check('München', 'NON_US', 'accents folded')
check('Frankfurt am Main', 'NON_US')
check('Hamburg', 'NON_US')
check('EMEA', 'NON_US')
check('APAC', 'NON_US')
check('Europe', 'NON_US')
check('British Columbia', 'NON_US')
check('Bengaluru, Karnataka, India, APAC', 'NON_US')

console.log('Unknown — no country named anywhere')
check('', 'UNKNOWN')
check(null, 'UNKNOWN')
check('Hybrid', 'UNKNOWN')
check('In-Office', 'UNKNOWN', 'must not tokenize to Indiana')
check('Remote', 'UNKNOWN')
check('Distributed', 'UNKNOWN')
check('Anywhere', 'UNKNOWN')
check('N/A', 'UNKNOWN')
check('North America', 'UNKNOWN', 'includes Canada and Mexico')

console.log('Job-level fallbacks')
checkJob(
  { location: 'Hybrid', title: 'Senior Account Executive, Startups (Denver)' },
  'US',
  'city in the title'
)
checkJob(
  { location: 'In-Office', title: 'Partner Solutions Architect Location New York, Atlanta, Charlotte and FL' },
  'US'
)
checkJob({ location: 'Hybrid', title: 'Manager, BDR - SAARC' }, 'NON_US', 'region in the title')
// A title is prose, so two-letter state codes hiding inside ordinary words
// must not decide it. These four German postings reached a US-only feed.
checkJob(
  { location: 'Kempten', title: 'Teamleiter:in Softwareentwicklung (m/w/d)', provider: 'ARBEITNOW' },
  'NON_US',
  '"Teamleiter:in" must not read as Indiana'
)
checkJob(
  { location: 'remote', title: 'Founding Scientist / Co-Founder', provider: 'ARBEITNOW' },
  'NON_US',
  '"Co-Founder" must not read as Colorado'
)
checkJob(
  { location: 'Soest', title: 'Softwareentwickler:in C#/.NET (m/w/x)', provider: 'ARBEITNOW' },
  'NON_US'
)
checkJob(
  { location: 'Monschau', title: 'Head of Engineering (m/w/d) in Imgenbroich', provider: 'ARBEITNOW' },
  'NON_US'
)
checkJob(
  { location: 'Boston, Massachusetts, United States', title: 'Recruiting Coordinator', provider: 'ARBEITNOW' },
  'US',
  'a real US posting on a German board still counts'
)
checkJob({ location: 'Remote', title: 'Software Engineer', provider: 'ARBEITNOW' }, 'NON_US', 'German board')
checkJob({ location: 'Remote', title: 'Software Engineer', provider: 'GREENHOUSE' }, 'UNKNOWN')
checkJob({ location: 'Austin, TX', title: 'Anything', provider: 'ARBEITNOW' }, 'US', 'location beats provider')

console.log('isUsJob gate')
if (isUsJob({ location: 'Austin, TX' }) !== true) { failed++; console.error('  FAIL isUsJob US') } else passed++
if (isUsJob({ location: 'London' }) !== false) { failed++; console.error('  FAIL isUsJob NON_US') } else passed++
if (isUsJob({ location: 'Hybrid' }) !== false) { failed++; console.error('  FAIL isUsJob UNKNOWN strict') } else passed++
if (isUsJob({ location: 'Hybrid' }, { allowUnknown: true }) !== true) { failed++; console.error('  FAIL isUsJob allowUnknown') } else passed++
if (isUsJob({ location: 'London' }, { allowUnknown: true }) !== false) { failed++; console.error('  FAIL allowUnknown must not admit NON_US') } else passed++

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
