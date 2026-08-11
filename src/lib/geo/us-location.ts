/**
 * US-only job filtering.
 *
 * The app targets the US market exclusively, so every job that enters the
 * database and every job that leaves an API is checked against this module.
 *
 * This deliberately does NOT build on `extractCountry()` in `@/lib/utils`.
 * That helper checks its country map before its US-state list, and the map
 * contains `'de' -> Germany` and `'in' -> India`, so "Wilmington, DE" resolves
 * to Germany and "Indianapolis, IN" to India. It also has no `'ca'` key, so
 * "Toronto, CA" falls through to the state list and resolves to the US. Those
 * are tolerable for a country-name dropdown but not for a hard include/exclude
 * gate, so US detection gets its own precedence-ordered implementation here.
 *
 * Precedence is the whole design. Two-letter codes collide constantly (CA is
 * California and Canada, IN is Indiana and India, DE is Delaware and Germany),
 * so an unambiguous signal is always consulted before an ambiguous one.
 */

export type UsVerdict = 'US' | 'NON_US' | 'UNKNOWN'

/** Unambiguous "this is the United States" phrases. */
const EXPLICIT_US = [
  'united states',
  'usa',
  'us based',
  'us only',
  'us remote',
  'remote us',
  'stateside',
  'nationwide',
  // 'america' is deliberately absent — it matches "North America", which
  // covers Canada and Mexico too.
]

/** Full US state names — unambiguous enough to decide on their own. */
const US_STATE_NAMES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'hawaii', 'idaho', 'illinois',
  'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
  'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
  'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico',
  'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee',
  'texas', 'utah', 'vermont', 'virginia', 'west virginia', 'wisconsin',
  'wyoming', 'district of columbia', 'washington dc', 'puerto rico',
  // 'georgia' is omitted on purpose — it is also a country. It is still
  // caught by its abbreviation and by Atlanta below.
])

/** Two-letter USPS codes. Only consulted after non-US signals are ruled out. */
const US_STATE_ABBR = new Set([
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'ia',
  'id', 'il', 'in', 'ks', 'ky', 'la', 'ma', 'md', 'me', 'mi', 'mn', 'mo',
  'ms', 'mt', 'nc', 'nd', 'ne', 'nh', 'nj', 'nm', 'nv', 'ny', 'oh', 'ok',
  'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'va', 'vt', 'wa', 'wi',
  'wv', 'wy', 'dc', 'pr',
])

/**
 * Country names and short forms that rule the US out. Two-letter codes that
 * collide with a USPS code (ca, de, in, pa, tn, ...) are handled separately
 * in FOREIGN_CODES below.
 */
const NON_US_COUNTRIES = [
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina',
  'armenia', 'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain',
  'bangladesh', 'belarus', 'belgium', 'belize', 'bolivia', 'bosnia',
  'botswana', 'brazil', 'brasil', 'bulgaria', 'cambodia', 'cameroon',
  'canada', 'chile', 'china', 'colombia', 'costa rica', 'croatia', 'cuba',
  'cyprus', 'czech republic', 'czechia', 'denmark', 'dominican republic',
  'ecuador', 'egypt', 'el salvador', 'estonia', 'ethiopia', 'finland',
  'france', 'germany', 'deutschland', 'ghana', 'greece', 'guatemala',
  'haiti', 'honduras', 'hong kong', 'hungary', 'iceland', 'india',
  'indonesia', 'iran', 'iraq', 'ireland', 'israel', 'italy', 'italia',
  'jamaica', 'japan', 'jordan', 'kazakhstan', 'kenya', 'kuwait', 'latvia',
  'lebanon', 'lithuania', 'luxembourg', 'malaysia', 'malta', 'mexico',
  'moldova', 'monaco', 'mongolia', 'montenegro', 'morocco', 'myanmar',
  'nepal', 'netherlands', 'new zealand', 'nicaragua', 'nigeria',
  'north macedonia', 'norway', 'oman', 'pakistan', 'palestine', 'panama',
  'paraguay', 'peru', 'philippines', 'poland', 'polska', 'portugal', 'qatar',
  'romania', 'russia', 'rwanda', 'saudi arabia', 'senegal', 'serbia',
  'singapore', 'slovakia', 'slovenia', 'south africa', 'south korea',
  'korea', 'spain', 'espana', 'sri lanka', 'sweden', 'sverige',
  'switzerland', 'taiwan', 'tanzania', 'thailand', 'tunisia', 'turkey',
  'turkiye', 'uganda', 'ukraine', 'united arab emirates', 'united kingdom',
  'uruguay', 'uzbekistan', 'venezuela', 'vietnam', 'zambia', 'zimbabwe',
  // Unambiguous short forms
  'uk', 'gb', 'england', 'scotland', 'wales', 'northern ireland',
  'great britain', 'britain', 'uae', 'ksa', 'saarc',
  // Canadian provinces and Australian states spelled out. 'ontario' and
  // 'victoria' are absent — both are also US cities — and live in
  // AMBIGUOUS_FOREIGN_CITIES instead.
  'british columbia', 'alberta', 'manitoba', 'saskatchewan', 'nova scotia',
  'new brunswick', 'newfoundland', 'prince edward island', 'yukon', 'nunavut',
  'northwest territories', 'queensland', 'new south wales', 'tasmania',
  'western australia', 'south australia', 'northern territory',
  'australian capital territory',
  // German federal states — the Arbeitnow feed labels jobs this way
  'baden wurttemberg', 'baden wuerttemberg', 'bayern', 'nordrhein westfalen',
  'niedersachsen', 'sachsen', 'hessen', 'rheinland pfalz', 'brandenburg',
  'schleswig holstein', 'thuringen', 'mecklenburg',
]

/** Multi-country regions — never US-specific. */
const NON_US_REGIONS = [
  'emea', 'apac', 'latam', 'anz', 'benelux', 'nordics', 'middle east',
  'europe', 'european union', 'eu remote', 'asia', 'africa', 'oceania',
  'south america', 'latin america', 'caribbean', 'balkans', 'scandinavia',
  'worldwide', 'global remote',
]

/**
 * Two-letter country codes that do NOT collide with any USPS state code, so
 * they can be trusted as a standalone token. Checked after US abbreviations.
 * Codes like CA/DE/IN/PA/TN/MA/ID/IL are absent by design — they are US states.
 */
const FOREIGN_CODES = new Set([
  'jp', 'cn', 'br', 'mx', 'cr', 'pl', 'au', 'fr', 'nl', 'se', 'sg', 'kr',
  'ie', 'ph', 'my', 'th', 'vn', 'ch', 'at', 'be', 'dk', 'fi', 'es', 'pt',
  'gr', 'cz', 'hu', 'ro', 'bg', 'rs', 'hr', 'tr', 'ae', 'sa', 'eg', 'za',
  'ng', 'ke', 'ua', 'ru', 'kz', 'tw', 'hk', 'nz', 'ee', 'lv', 'lt', 'si',
  'sk', 'lu', 'mt', 'cy', 'bd', 'lk', 'np', 'uy', 'py', 'bo', 'ec', 've',
  'gt', 'sv', 'ni', 'jm', 'tt', 'bs', 'bb', 'gb', 'uk', 'dz',
  // Canadian provinces and Australian states
  'bc', 'qc', 'ab', 'mb', 'sk', 'ns', 'nb', 'pe', 'nl', 'yt', 'nu',
  'nsw', 'qld', 'vic', 'tas', 'act',
])

/**
 * Foreign cities distinctive enough to decide on their own — no meaningful US
 * namesake. Cities that DO have a US namesake live in AMBIGUOUS_FOREIGN_CITIES.
 */
const NON_US_CITIES = [
  'abu dhabi', 'accra', 'addis ababa', 'amsterdam', 'ankara', 'antwerp',
  'auckland', 'bangalore', 'bengaluru', 'bangkok', 'barcelona', 'beijing',
  'beirut', 'belfast', 'belgrade', 'berlin', 'bogota', 'bratislava',
  'brisbane', 'brussels', 'bucharest', 'budapest', 'buenos aires', 'cairo',
  'cape town', 'caracas', 'casablanca', 'chennai', 'chengdu', 'colombo',
  'copenhagen', 'cork', 'curitiba', 'dar es salaam', 'delhi', 'dhaka',
  'doha', 'dortmund', 'dubai', 'dusseldorf', 'duesseldorf', 'edinburgh',
  'eindhoven', 'erlangen', 'florianopolis', 'frankfurt', 'fukuoka', 'geneva',
  'genoa', 'glasgow', 'gothenburg', 'guadalajara', 'guangzhou', 'gurgaon',
  'gurugram', 'hanoi', 'hangzhou', 'heidelberg', 'helsinki', 'ho chi minh',
  'hockenheim', 'hyderabad', 'islamabad', 'istanbul', 'jakarta', 'jeddah',
  'johannesburg', 'karachi', 'kathmandu', 'kiev', 'kyiv', 'kigali',
  'kolkata', 'krakow', 'kuala lumpur', 'lagos', 'lahore', 'leeds', 'leipzig',
  'leuven', 'liverpool', 'ljubljana', 'lisbon', 'lisboa', 'london', 'lyon',
  'madrid', 'malmo', 'managua', 'manama', 'manila', 'mannheim', 'marseille',
  'medellin', 'melbourne', 'mexico city', 'milan', 'milano', 'minsk',
  'monterrey', 'montevideo', 'montreal', 'mulheim', 'muelheim', 'mumbai',
  'munich', 'munchen', 'muenchen', 'muscat', 'nairobi', 'nanjing', 'nantes',
  'new delhi', 'noida', 'nuremberg', 'nurnberg', 'osaka', 'oslo', 'ottawa',
  'paris', 'perth', 'porto', 'porto alegre', 'prague', 'praha', 'pune',
  'quebec', 'quito', 'recife', 'reykjavik', 'riga', 'rio de janeiro',
  'riyadh', 'rotterdam', 'saigon', 'santiago', 'sao paulo', 'sapporo',
  'seoul', 'sevilla', 'seville', 'shanghai', 'shenzhen', 'sofia',
  'st petersburg', 'saint petersburg', 'stockholm', 'stuttgart', 'sydney',
  'taipei', 'tallinn', 'tbilisi', 'tehran', 'tel aviv', 'the hague',
  'thessaloniki', 'tijuana', 'tokyo', 'toronto', 'toulouse', 'townsville',
  'vienna', 'viersen', 'vilnius', 'warsaw', 'warszawa', 'wellington',
  'wroclaw', 'yerevan', 'zagreb', 'zurich', 'zuerich',
  // German cities with no US namesake in these feeds
  'hamburg', 'cologne', 'koln', 'koeln', 'bonn', 'darmstadt', 'wiesbaden',
  'karlsruhe', 'freiburg', 'aachen', 'essen', 'duisburg', 'bochum',
]

/**
 * Cities that exist in both the US and abroad. These only decide the verdict
 * once every US signal has been ruled out, so "Dublin, OH" stays US while a
 * bare "Dublin" resolves to Ireland — which matches the data, where every
 * bare-"Dublin" posting belongs to Stripe's and MongoDB's Irish offices.
 */
const AMBIGUOUS_FOREIGN_CITIES = [
  'dublin', 'vancouver', 'manchester', 'birmingham', 'cambridge', 'bristol',
  'hamilton', 'kingston', 'windsor', 'waterloo', 'london', 'newcastle',
  'oxford', 'brighton', 'cheltenham', 'cumbria', 'surrey', 'adelaide',
  'calgary', 'halifax', 'victoria', 'ontario', 'richmond hill', 'markham',
  'mississauga', 'burnaby', 'laval', 'gatineau',
  // 'york' is deliberately absent: it matches inside "New York City", and
  // York, UK barely appears in these feeds while New York dominates them.
]

/** US cities that stand alone without a state token, as a last resort. */
const US_CITIES = [
  'albuquerque', 'ann arbor', 'atlanta', 'austin', 'baltimore', 'bellevue',
  'berkeley', 'bethesda', 'boca raton', 'boise', 'boston', 'boulder',
  'brooklyn', 'buffalo', 'burbank', 'chapel hill', 'charlotte',
  'chattanooga', 'chicago', 'cincinnati', 'cleveland', 'colorado springs',
  'columbus', 'culver city', 'cupertino', 'dallas', 'dayton', 'denver',
  'des moines', 'detroit', 'durham', 'el segundo', 'foster city',
  'fort worth', 'fremont', 'grand rapids', 'greenville', 'hawthorne',
  'hoboken', 'honolulu', 'houston', 'indianapolis', 'irvine', 'jersey city',
  'kansas city', 'kirkland', 'knoxville', 'las vegas', 'lehi', 'lexington',
  'lincoln', 'long beach', 'los altos', 'los angeles', 'louisville',
  'madison', 'manhattan beach', 'memphis', 'menlo park', 'mesa', 'miami',
  'milwaukee', 'minneapolis', 'mountain view', 'nashville', 'new orleans',
  'new york', 'newark', 'newport beach', 'oakland', 'oklahoma city', 'omaha',
  'orlando', 'palo alto', 'pasadena', 'philadelphia', 'phoenix', 'pittsburgh',
  'plano', 'portland', 'providence', 'raleigh', 'redmond', 'redwood city',
  'reno', 'reston', 'richardson', 'sacramento', 'salt lake', 'san antonio',
  'san bruno', 'san diego', 'san francisco', 'san jose', 'san mateo',
  'san rafael', 'san ramon', 'santa barbara', 'santa clara', 'santa monica',
  'sarasota', 'scottsdale', 'seattle', 'silicon valley', 'south bend',
  'spokane', 'st louis', 'saint louis', 'st paul', 'saint paul', 'stamford',
  'sunnyvale', 'tacoma', 'tampa', 'tempe', 'tucson', 'tulsa', 'vandenberg',
  'walnut creek', 'west hollywood', 'westlake village', 'wilmington',
  'winston salem', 'woburn', 'woodinville', 'starbase', 'bastrop',
  'mcgregor', 'cape canaveral', 'canandaigua',
  'bay area', 'sf bay', 'nyc', 'sf',
]

/**
 * Work-arrangement words that describe *how* you work, not *where*. Stripped
 * before tokenizing so "In-Office" does not tokenize to ["in", "office"] and
 * match Indiana.
 */
const ARRANGEMENT_NOISE =
  /\b(in[ -]?office|on[ -]?site|onsite|hybrid|remote|distributed|flexible|work from home|wfh|hq|headquarters|office|select locations|all locations|multiple locations|various|n\/a)\b/g

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalize(location: string): string {
  return location
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[•·|/\\]+/g, ',')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[–—]/g, '-')
    // Drop punctuation that would otherwise stick to a token and stop it
    // matching, e.g. "Remote - US: Select locations" -> "us" not "us:".
    .replace(/[.:*"']/g, ' ')
    .replace(/\s+/g, ' ')
    // Re-join initialisms the period-strip just split apart, so "U.S.",
    // "U.S.A." and "D.C." survive as single tokens.
    .replace(/\bu s a\b/g, 'usa')
    .replace(/\bu s\b/g, 'us')
    .replace(/\bd c\b/g, 'dc')
    .trim()
}

/** Comma/dash-delimited parts, e.g. "US-CA-Menlo Park" -> us, ca, menlo park. */
function toTokens(normalized: string): string[] {
  return normalized
    .split(/[,;]/)
    .flatMap(p => p.split('-'))
    .flatMap(p => p.split(' '))
    .map(p => p.trim())
    .filter(Boolean)
}

/** True when `needle` appears in `haystack` on word boundaries. */
function hasPhrase(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(haystack)
}

/** Comma-separated parts kept whole, for exact multi-word matches. */
function toParts(normalized: string): string[] {
  return normalized
    .split(/[,;]/)
    .flatMap(p => p.split('-'))
    .map(p => p.trim())
    .filter(Boolean)
}

/**
 * Classify a single location string.
 *
 * Order of checks, most trustworthy first:
 *   1. explicit "United States"/"USA"     -> US   (wins outright, so multi-site
 *                                                  posts like "London • New
 *                                                  York, NY • United States"
 *                                                  count as US-eligible)
 *   2. named foreign country or region    -> NON_US
 *   3. full US state name                 -> US
 *   4. distinctive foreign city           -> NON_US
 *   5. USPS state abbreviation            -> US
 *   6. foreign country/province code      -> NON_US
 *   7. city that is usually foreign       -> NON_US
 *   8. known US city                      -> US
 *   9. nothing recognisable               -> UNKNOWN
 */
export interface ClassifyOptions {
  /**
   * The text is free prose (a job title), not a location field.
   *
   * Bare two-letter codes are then ignored, because ordinary words tokenize
   * into them: the German "Teamleiter:in Softwareentwicklung" yields `in`
   * (Indiana) and "Founding Scientist / Co-Founder" yields `co` (Colorado).
   * Both put German postings into a US-only feed before this existed.
   */
  prose?: boolean
}

export function classifyUsLocation(
  location: string | null | undefined,
  options: ClassifyOptions = {}
): UsVerdict {
  if (!location || !location.trim()) return 'UNKNOWN'

  const raw = normalize(location)
  // Strip arrangement words for token analysis, but keep `raw` for phrases.
  const norm = raw.replace(ARRANGEMENT_NOISE, ' ').replace(/\s+/g, ' ').trim()
  if (!norm) return 'UNKNOWN'

  const tokens = toTokens(norm)
  const parts = toParts(norm)

  // 1. Explicit US wording, plus the "US, WA, Seattle" shape Amazon uses.
  if (EXPLICIT_US.some(p => hasPhrase(norm, p))) return 'US'
  if (!options.prose && tokens.includes('us')) return 'US'

  // 2. A named country or multi-country region rules the US out.
  if (NON_US_COUNTRIES.some(c => hasPhrase(norm, c))) return 'NON_US'
  if (NON_US_REGIONS.some(r => hasPhrase(norm, r))) return 'NON_US'

  // 3. Full state names.
  if (parts.some(p => US_STATE_NAMES.has(p))) return 'US'
  if (US_STATE_NAMES.has(norm)) return 'US'

  // 4. Foreign cities with no US namesake.
  if (NON_US_CITIES.some(c => hasPhrase(norm, c))) return 'NON_US'

  // 5/6. Two-letter codes, now that unambiguous foreign signals are out.
  // Skipped for prose, where ordinary words tokenize into state codes.
  if (!options.prose) {
    if (tokens.some(t => US_STATE_ABBR.has(t))) return 'US'
    if (tokens.some(t => FOREIGN_CODES.has(t))) return 'NON_US'
  }

  // 7. Cities that exist both here and abroad, with no US signal anywhere.
  if (AMBIGUOUS_FOREIGN_CITIES.some(c => hasPhrase(norm, c))) return 'NON_US'

  // 8. US cities that appear without a state token.
  if (US_CITIES.some(c => hasPhrase(norm, c))) return 'US'

  return 'UNKNOWN'
}

/** Providers whose board is regional, used only to break UNKNOWN ties. */
const NON_US_PROVIDERS = new Set(['ARBEITNOW'])

export interface ClassifiableJob {
  location?: string | null
  title?: string | null
  provider?: string | null
  isRemote?: boolean
}

/**
 * Classify a job, falling back past an unhelpful location field.
 *
 * Some boards put a work arrangement in `location` ("Hybrid", "In-Office" —
 * Cloudflare posts 300+ jobs this way) and the real city in the title, e.g.
 * "Senior Account Executive, Startups (Denver)". So when the location is
 * inconclusive we read the title, then fall back to the provider's home market.
 */
export function classifyUsJob(job: ClassifiableJob): UsVerdict {
  const byLocation = classifyUsLocation(job.location)
  if (byLocation !== 'UNKNOWN') return byLocation

  const byTitle = classifyUsLocation(job.title, { prose: true })
  if (byTitle !== 'UNKNOWN') return byTitle

  if (job.provider && NON_US_PROVIDERS.has(job.provider)) return 'NON_US'

  return 'UNKNOWN'
}

/**
 * Prisma fragment for the US-only read paths.
 *
 * The verdict is persisted on Job.isUs at ingest (see src/lib/job-fetcher)
 * and backfilled by scripts/purge-non-us-jobs.ts, so the filter runs in SQL —
 * filtering in JS after the query would break pagination totals. Spread this
 * into a `where` rather than writing `isUs: true` inline, so every read path
 * changes together.
 */
export const US_ONLY_WHERE = { isUs: true } as const

/**
 * The gate used by ingest and by every read path.
 *
 * `UNKNOWN` is rejected by default: the requirement is US-only, and a posting
 * that never names a country cannot be presented as one. Pass `allowUnknown`
 * where a softer filter is wanted.
 */
export function isUsJob(job: ClassifiableJob, options: { allowUnknown?: boolean } = {}): boolean {
  const verdict = classifyUsJob(job)
  if (verdict === 'US') return true
  return verdict === 'UNKNOWN' && Boolean(options.allowUnknown)
}
