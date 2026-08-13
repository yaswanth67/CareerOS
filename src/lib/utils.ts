import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(d)
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success-600 bg-success-100 dark:bg-success-500/20 dark:text-success-400'
  if (score >= 60) return 'text-warning-600 bg-warning-100 dark:bg-warning-500/20 dark:text-warning-400'
  return 'text-gray-600 bg-gray-100 dark:bg-gray-500/20 dark:text-gray-400'
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Strong Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Weak Match'
  return 'Poor Match'
}

const ROLE_LABELS: Record<string, string> = {
  SDE: 'Software Engineer',
  AI_ENGINEER: 'AI Engineer',
  ML_ENGINEER: 'ML Engineer',
  DATA_SCIENTIST: 'Data Scientist',
  DATA_ENGINEER: 'Data Engineer',
  DEVOPS: 'DevOps Engineer',
  SRE: 'SRE Engineer',
  FULLSTACK: 'Full Stack Developer',
  FRONTEND: 'Frontend Developer',
  BACKEND: 'Backend Developer',
  MOBILE: 'Mobile Developer',
  EMBEDDED: 'Embedded Engineer',
  SECURITY: 'Security Engineer',
  QA: 'QA Engineer',
  PM: 'Product Manager',
  OTHER: 'Other',
}

export function getRoleLabel(roleType: string): string {
  return ROLE_LABELS[roleType] ?? roleType
}

const EXPERIENCE_LABELS: Record<string, string> = {
  ENTRY: 'Entry Level',
  MID: 'Mid Level',
  SENIOR: 'Senior',
  STAFF: 'Staff',
  PRINCIPAL: 'Principal',
}

export function getExperienceLabel(level: string): string {
  return EXPERIENCE_LABELS[level] ?? level
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length).trim() + '...'
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

/**
 * SQLite has no native array type, so array-valued columns (skills, requirements,
 * experience, education, matchedSkills, missingSkills) are stored as JSON strings.
 * This safely converts a stored value back into an array.
 */
export function parseJsonArray<T = unknown>(
  value: string | string[] | null | undefined,
  fallback: T[] = []
): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

/** Serialize an array for storage in a JSON-string column. */
export function stringifyJsonArray(value: unknown): string {
  return JSON.stringify(value ?? [])
}

/**
 * Country extraction utilities for job location filtering
 */

// Map of common location patterns to standardized country names
const COUNTRY_MAP: Record<string, string> = {
  // United States
  'united states': 'United States',
  'usa': 'United States',
  'us': 'United States',
  'u.s.': 'United States',
  'america': 'United States',
  'remote - us': 'United States',
  'remote - usa': 'United States',
  'remote (us)': 'United States',
  'remote (usa)': 'United States',
  'remote (united states)': 'United States',
  'us remote': 'United States',
  'us-remote': 'United States',
  'remote us': 'United States',
  'remote usa': 'United States',
  'united states remote': 'United States',

  // Canada
  'canada': 'Canada',
  'remote - canada': 'Canada',
  'remote (canada)': 'Canada',
  'ca-remote': 'Canada',
  'ca remote': 'Canada',
  'canada remote': 'Canada',

  // United Kingdom
  'united kingdom': 'United Kingdom',
  'uk': 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  'britain': 'United Kingdom',
  'remote - uk': 'United Kingdom',
  'remote - united kingdom': 'United Kingdom',
  'remote (uk)': 'United Kingdom',
  'remote (united kingdom)': 'United Kingdom',
  'uk remote': 'United Kingdom',
  'united kingdom remote': 'United Kingdom',

  // Germany
  'germany': 'Germany',
  'de': 'Germany',
  'remote - germany': 'Germany',
  'remote (germany)': 'Germany',
  'de-remote': 'Germany',
  'germany remote': 'Germany',

  // France
  'france': 'France',
  'fr': 'France',
  'remote - france': 'France',
  'remote (france)': 'France',
  'france remote': 'France',

  // India
  'india': 'India',
  'in': 'India',
  'remote - india': 'India',
  'remote (india)': 'India',
  'india remote': 'India',

  // Australia
  'australia': 'Australia',
  'au': 'Australia',
  'remote - australia': 'Australia',
  'remote (australia)': 'Australia',
  'australia remote': 'Australia',

  // Singapore
  'singapore': 'Singapore',
  'sg': 'Singapore',
  'remote - singapore': 'Singapore',
  'remote (singapore)': 'Singapore',
  'singapore remote': 'Singapore',

  // Japan
  'japan': 'Japan',
  'jp': 'Japan',
  'remote - japan': 'Japan',
  'remote (japan)': 'Japan',
  'japan remote': 'Japan',

  // Ireland
  'ireland': 'Ireland',
  'ie': 'Ireland',
  'remote - ireland': 'Ireland',
  'remote (ireland)': 'Ireland',
  'ireland remote': 'Ireland',

  // Netherlands
  'netherlands': 'Netherlands',
  'nl': 'Netherlands',
  'holland': 'Netherlands',
  'remote - netherlands': 'Netherlands',
  'remote (netherlands)': 'Netherlands',
  'netherlands remote': 'Netherlands',

  // Switzerland
  'switzerland': 'Switzerland',
  'ch': 'Switzerland',
  'remote - switzerland': 'Switzerland',
  'remote (switzerland)': 'Switzerland',
  'switzerland remote': 'Switzerland',

  // Sweden
  'sweden': 'Sweden',
  'se': 'Sweden',
  'remote - sweden': 'Sweden',
  'remote (sweden)': 'Sweden',
  'sweden remote': 'Sweden',

  // Spain
  'spain': 'Spain',
  'es': 'Spain',
  'remote - spain': 'Spain',
  'remote (spain)': 'Spain',
  'spain remote': 'Spain',

  // Poland
  'poland': 'Poland',
  'pl': 'Poland',
  'remote - poland': 'Poland',
  'remote (poland)': 'Poland',
  'poland remote': 'Poland',

  // Brazil
  'brazil': 'Brazil',
  'br': 'Brazil',
  'remote - brazil': 'Brazil',
  'remote (brazil)': 'Brazil',
  'brazil remote': 'Brazil',

  // Mexico
  'mexico': 'Mexico',
  'mx': 'Mexico',
  'remote - mexico': 'Mexico',
  'remote (mexico)': 'Mexico',
  'mexico remote': 'Mexico',

  // Israel
  'israel': 'Israel',
  'il': 'Israel',
  'remote - israel': 'Israel',
  'remote (israel)': 'Israel',
  'israel remote': 'Israel',

  // UAE / Dubai
  'united arab emirates': 'United Arab Emirates',
  'uae': 'United Arab Emirates',
  'dubai': 'United Arab Emirates',
  'abu dhabi': 'United Arab Emirates',
  'remote - uae': 'United Arab Emirates',
  'remote (uae)': 'United Arab Emirates',

  // South Korea
  'south korea': 'South Korea',
  'korea': 'South Korea',
  'kr': 'South Korea',
  'seoul': 'South Korea',
  'remote - south korea': 'South Korea',
  'remote (south korea)': 'South Korea',

  // China
  'china': 'China',
  'cn': 'China',
  'beijing': 'China',
  'shanghai': 'China',
  'shenzhen': 'China',
  'remote - china': 'China',
  'remote (china)': 'China',

  // New Zealand
  'new zealand': 'New Zealand',
  'nz': 'New Zealand',
  'auckland': 'New Zealand',
  'remote - new zealand': 'New Zealand',
  'remote (new zealand)': 'New Zealand',

  // Denmark
  'denmark': 'Denmark',
  'dk': 'Denmark',
  'copenhagen': 'Denmark',
  'remote - denmark': 'Denmark',
  'remote (denmark)': 'Denmark',

  // Norway
  'norway': 'Norway',
  'no': 'Norway',
  'oslo': 'Norway',
  'remote - norway': 'Norway',
  'remote (norway)': 'Norway',

  // Belgium
  'belgium': 'Belgium',
  'be': 'Belgium',
  'brussels': 'Belgium',
  'remote - belgium': 'Belgium',
  'remote (belgium)': 'Belgium',

  // Austria
  'austria': 'Austria',
  'at': 'Austria',
  'vienna': 'Austria',
  'remote - austria': 'Austria',
  'remote (austria)': 'Austria',

  // Portugal
  'portugal': 'Portugal',
  'pt': 'Portugal',
  'lisbon': 'Portugal',
  'remote - portugal': 'Portugal',
  'remote (portugal)': 'Portugal',

  // Italy
  'italy': 'Italy',
  'it': 'Italy',
  'rome': 'Italy',
  'milan': 'Italy',
  'remote - italy': 'Italy',
  'remote (italy)': 'Italy',

  // Finland
  'finland': 'Finland',
  'fi': 'Finland',
  'helsinki': 'Finland',
  'remote - finland': 'Finland',
  'remote (finland)': 'Finland',

  // Malaysia
  'malaysia': 'Malaysia',
  'my': 'Malaysia',
  'kuala lumpur': 'Malaysia',
  'remote - malaysia': 'Malaysia',
  'remote (malaysia)': 'Malaysia',

  // Philippines
  'philippines': 'Philippines',
  'ph': 'Philippines',
  'manila': 'Philippines',
  'remote - philippines': 'Philippines',
  'remote (philippines)': 'Philippines',

  // Thailand
  'thailand': 'Thailand',
  'th': 'Thailand',
  'bangkok': 'Thailand',
  'remote - thailand': 'Thailand',
  'remote (thailand)': 'Thailand',

  // Vietnam
  'vietnam': 'Vietnam',
  'vn': 'Vietnam',
  'ho chi minh': 'Vietnam',
  'hanoi': 'Vietnam',
  'remote - vietnam': 'Vietnam',
  'remote (vietnam)': 'Vietnam',

  // Indonesia
  'indonesia': 'Indonesia',
  'id': 'Indonesia',
  'jakarta': 'Indonesia',
  'remote - indonesia': 'Indonesia',
  'remote (indonesia)': 'Indonesia',

  // Hong Kong
  'hong kong': 'Hong Kong',
  'hk': 'Hong Kong',
  'remote - hong kong': 'Hong Kong',
  'remote (hong kong)': 'Hong Kong',

  // Taiwan
  'taiwan': 'Taiwan',
  'tw': 'Taiwan',
  'taipei': 'Taiwan',
  'remote - taiwan': 'Taiwan',
  'remote (taiwan)': 'Taiwan',

  // South Africa
  'south africa': 'South Africa',
  'za': 'South Africa',
  'remote - south africa': 'South Africa',
  'remote (south africa)': 'South Africa',

  // Argentina
  'argentina': 'Argentina',
  'ar': 'Argentina',
  'buenos aires': 'Argentina',
  'remote - argentina': 'Argentina',
  'remote (argentina)': 'Argentina',

  // Chile
  'chile': 'Chile',
  'cl': 'Chile',
  'santiago': 'Chile',
  'remote - chile': 'Chile',
  'remote (chile)': 'Chile',

  // Colombia
  'colombia': 'Colombia',
  'co': 'Colombia',
  'bogota': 'Colombia',
  'remote - colombia': 'Colombia',
  'remote (colombia)': 'Colombia',

  // Costa Rica
  'costa rica': 'Costa Rica',
  'cr': 'Costa Rica',
  'san jose': 'Costa Rica',
  'remote - costa rica': 'Costa Rica',
  'remote (costa rica)': 'Costa Rica',

  // Peru
  'peru': 'Peru',
  'pe': 'Peru',
  'lima': 'Peru',
  'remote - peru': 'Peru',
  'remote (peru)': 'Peru',

  // Nigeria
  'nigeria': 'Nigeria',
  'ng': 'Nigeria',
  'lagos': 'Nigeria',
  'remote - nigeria': 'Nigeria',
  'remote (nigeria)': 'Nigeria',

  // Kenya
  'kenya': 'Kenya',
  'ke': 'Kenya',
  'nairobi': 'Kenya',
  'remote - kenya': 'Kenya',
  'remote (kenya)': 'Kenya',

  // Egypt
  'egypt': 'Egypt',
  'eg': 'Egypt',
  'cairo': 'Egypt',
  'remote - egypt': 'Egypt',
  'remote (egypt)': 'Egypt',

  // Remote / Global
  'remote': 'Global/Remote',
  'distributed': 'Global/Remote',
  'anywhere': 'Global/Remote',
  'worldwide': 'Global/Remote',
  'global': 'Global/Remote',
  'remote - emea': 'EMEA (Remote)',
  'remote - na': 'North America (Remote)',
  'remote - apac': 'APAC (Remote)',
  'remote - latam': 'LATAM (Remote)',
}

// US State to country mapping
const US_STATES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
  'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
  'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia',
  'washington', 'west virginia', 'wisconsin', 'wyoming',
  // Abbreviations
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id',
  'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
  'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok',
  'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy',
  'dc', 'district of columbia'
])

// Canadian provinces
const CA_PROVINCES = new Set([
  'alberta', 'british columbia', 'manitoba', 'new brunswick', 'newfoundland',
  'nova scotia', 'ontario', 'prince edward island', 'quebec', 'saskatchewan',
  'northwest territories', 'nunavut', 'yukon',
  'ab', 'bc', 'mb', 'nb', 'nl', 'ns', 'on', 'pe', 'qc', 'sk', 'nt', 'nu', 'yt'
])

// Australian states
const AU_STATES = new Set([
  'new south wales', 'victoria', 'queensland', 'western australia',
  'south australia', 'tasmania', 'northern territory', 'australian capital territory',
  'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'nt', 'act'
])

/**
 * Extract standardized country name from a job location string.
 * Returns null if country cannot be determined.
 */
export function extractCountry(location: string | null | undefined): string | null {
  if (!location) return null

  const normalized = location.toLowerCase().trim()

  // Check direct country map first
  if (COUNTRY_MAP[normalized]) {
    return COUNTRY_MAP[normalized]
  }

  // Check for "Remote - CC" or "Remote (CC)" patterns
  const remoteMatch = normalized.match(/remote\s*[-(]\s*([a-z]{2})\s*[)-]/)
  if (remoteMatch) {
    const code = remoteMatch[1].toUpperCase()
    const mapped = COUNTRY_MAP[`remote - ${code.toLowerCase()}`]
    if (mapped) return mapped
  }

  // Check for "Country - Remote" pattern
  const countryRemoteMatch = normalized.match(/^([a-z\s]+)\s*-\s*remote$/)
  if (countryRemoteMatch) {
    const country = countryRemoteMatch[1].trim()
    if (COUNTRY_MAP[country]) return COUNTRY_MAP[country]
  }

  // Split by common delimiters
  const parts = normalized.split(/[,;|]/).map(p => p.trim()).filter(Boolean)

  // Check each part for country match
  for (const part of parts) {
    // Direct match
    if (COUNTRY_MAP[part]) return COUNTRY_MAP[part]

    // Check if it's a US state
    if (US_STATES.has(part)) return 'United States'

    // Check if it's a Canadian province
    if (CA_PROVINCES.has(part)) return 'Canada'

    // Check if it's an Australian state
    if (AU_STATES.has(part)) return 'Australia'

    // Check if part ends with known country
    for (const [key, value] of Object.entries(COUNTRY_MAP)) {
      if (part.endsWith(key) && key.length > 2) return value
    }
  }

  // Check for known city names that imply country
  const cityToCountry: Record<string, string> = {
    // North America
    'london': 'United Kingdom',
    'new york': 'United States',
    'san francisco': 'United States',
    'san francisco bay area': 'United States',
    'new york city': 'United States',
    'los angeles': 'United States',
    'chicago': 'United States',
    'boston': 'United States',
    'seattle': 'United States',
    'austin': 'United States',
    'denver': 'United States',
    'atlanta': 'United States',
    'miami': 'United States',
    'dallas': 'United States',
    'houston': 'United States',
    'washington': 'United States',
    'washington dc': 'United States',
    'mountain view': 'United States',
    'palo alto': 'United States',
    'bellevue': 'United States',
    'redmond': 'United States',
    'sunnyvale': 'United States',
    'irvine': 'United States',
    'toronto': 'Canada',
    'vancouver': 'Canada',
    'montreal': 'Canada',
    'calgary': 'Canada',
    'ottawa': 'Canada',
    'waterloo': 'Canada',
    'mexico city': 'Mexico',
    'guadalajara': 'Mexico',
    'monterrey': 'Mexico',
    'san jose': 'Costa Rica',
    'panama city': 'Panama',
    'san salvador': 'El Salvador',
    'guatemala city': 'Guatemala',
    'managua': 'Nicaragua',
    'tegucigalpa': 'Honduras',
    'san pedro sula': 'Honduras',
    'havana': 'Cuba',
    'santo domingo': 'Dominican Republic',
    'port au prince': 'Haiti',
    'kingston': 'Jamaica',
    'port of spain': 'Trinidad and Tobago',
    'nassau': 'Bahamas',
    'hamilton': 'Bermuda',

    // Europe
    'london uk': 'United Kingdom',
    'manchester': 'United Kingdom',
    'edinburgh': 'United Kingdom',
    'birmingham': 'United Kingdom',
    'paris': 'France',
    'lyon': 'France',
    'marseille': 'France',
    'berlin': 'Germany',
    'munich': 'Germany',
    'frankfurt': 'Germany',
    'hamburg': 'Germany',
    'cologne': 'Germany',
    'amsterdam': 'Netherlands',
    'rotterdam': 'Netherlands',
    'zurich': 'Switzerland',
    'geneva': 'Switzerland',
    'stockholm': 'Sweden',
    'gothenburg': 'Sweden',
    'copenhagen': 'Denmark',
    'dublin': 'Ireland',
    'cork': 'Ireland',
    'madrid': 'Spain',
    'barcelona': 'Spain',
    'rome': 'Italy',
    'milan': 'Italy',
    'vienna': 'Austria',
    'lisbon': 'Portugal',
    'warsaw': 'Poland',
    'krakow': 'Poland',
    'prague': 'Czech Republic',
    'budapest': 'Hungary',
    'bucharest': 'Romania',
    'sofia': 'Bulgaria',
    'belgrade': 'Serbia',
    'zagreb': 'Croatia',
    'ljubljana': 'Slovenia',
    'bratislava': 'Slovakia',
    'helsinki': 'Finland',
    'oslo': 'Norway',
    'reykjavik': 'Iceland',
    'tallinn': 'Estonia',
    'riga': 'Latvia',
    'vilnius': 'Lithuania',
    'moscow': 'Russia',
    'saint petersburg': 'Russia',
    'kiev': 'Ukraine',
    'kyiv': 'Ukraine',
    'tbilisi': 'Georgia',
    'yerevan': 'Armenia',
    'baku': 'Azerbaijan',
    'istanbul': 'Turkey',
    'ankara': 'Turkey',

    // Middle East
    'dubai': 'United Arab Emirates',
    'abu dhabi': 'United Arab Emirates',
    'riyadh': 'Saudi Arabia',
    'jeddah': 'Saudi Arabia',
    'doha': 'Qatar',
    'kuwait city': 'Kuwait',
    'manama': 'Bahrain',
    'muscat': 'Oman',
    'tehran': 'Iran',
    'baghdad': 'Iraq',
    'damascus': 'Syria',
    'beirut': 'Lebanon',
    'amman': 'Jordan',
    'jerusalem': 'Israel',
    'tel aviv': 'Israel',
    'haifa': 'Israel',

    // Asia Pacific
    'bangalore': 'India',
    'bengaluru': 'India',
    'mumbai': 'India',
    'delhi': 'India',
    'hyderabad': 'India',
    'chennai': 'India',
    'pune': 'India',
    'gurgaon': 'India',
    'noida': 'India',
    'kolkata': 'India',
    'singapore': 'Singapore',
    'tokyo': 'Japan',
    'osaka': 'Japan',
    'seoul': 'South Korea',
    'beijing': 'China',
    'shanghai': 'China',
    'shenzhen': 'China',
    'hong kong': 'Hong Kong',
    'taipei': 'Taiwan',
    'sydney': 'Australia',
    'melbourne': 'Australia',
    'brisbane': 'Australia',
    'perth': 'Australia',
    'adelaide': 'Australia',
    'auckland': 'New Zealand',
    'wellington': 'New Zealand',

    // South America
    'sao paulo': 'Brazil',
    'rio de janeiro': 'Brazil',
    'buenos aires': 'Argentina',
    'santiago': 'Chile',
    'bogota': 'Colombia',
    'lima': 'Peru',
    'caracas': 'Venezuela',
    'quito': 'Ecuador',
    'la paz': 'Bolivia',
    'montevideo': 'Uruguay',
    'asuncion': 'Paraguay',

    // Africa
    'cairo': 'Egypt',
    'alexandria': 'Egypt',
    'tripoli': 'Libya',
    'tunis': 'Tunisia',
    'algiers': 'Algeria',
    'casablanca': 'Morocco',
    'rabat': 'Morocco',
    'tangier': 'Morocco',
    'dakar': 'Senegal',
    'abidjan': "Ivory Coast",
    'accra': 'Ghana',
    'lagos': 'Nigeria',
    'abuja': 'Nigeria',
    'kinshasa': 'DR Congo',
    'luanda': 'Angola',
    'lilongwe': 'Malawi',
    'lusaka': 'Zambia',
    'harare': 'Zimbabwe',
    'maputo': 'Mozambique',
    'windhoek': 'Namibia',
    'gaborone': 'Botswana',
    'maseru': 'Lesotho',
    'mbabane': 'Eswatini',
    'kampala': 'Uganda',
    'nairobi': 'Kenya',
    'dar es salaam': 'Tanzania',
    'dodoma': 'Tanzania',
    'kigali': 'Rwanda',
    'bujumbura': 'Burundi',
    'mogadishu': 'Somalia',
    'hargeisa': 'Somaliland',
    'djibouti': 'Djibouti',
    'asmara': 'Eritrea',
    'addis ababa': 'Ethiopia',
    'khartoum': 'Sudan',
    'juba': 'South Sudan',
    'n\'djamena': 'Chad',
    'bangui': 'Central African Republic',
    'libreville': 'Gabon',
    'brazzaville': 'Republic of Congo',
    'porto-novo': 'Benin',
    'lome': 'Togo',
    'ouagadougou': 'Burkina Faso',
    'bamako': 'Mali',
    'niamey': 'Niger',
    'conakry': 'Guinea',
    'freelown': 'Sierra Leone',
    'banjul': 'Gambia',
    'bissau': 'Guinea-Bissau',
    'praia': 'Cape Verde',
    'sao tome': 'Sao Tome and Principe',
    'moroni': 'Comoros',
    'victoria': 'Seychelles',
    'port louis': 'Mauritius',
    'antananarivo': 'Madagascar',

    // Central Asia
    'ashgabat': 'Turkmenistan',
    'dushanbe': 'Tajikistan',
    'bishkek': 'Kyrgyzstan',
    'tashkent': 'Uzbekistan',

    // South Asia
    'kathmandu': 'Nepal',
    'thimphu': 'Bhutan',
    'dhaka': 'Bangladesh',
    'colombo': 'Sri Lanka',
    'male': 'Maldives',
    'kabul': 'Afghanistan',
    'islamabad': 'Pakistan',
    'karachi': 'Pakistan',
    'lahore': 'Pakistan',
  }

  for (const [city, country] of Object.entries(cityToCountry)) {
    if (normalized.includes(city.toLowerCase())) return country
  }

  return null
}

/**
 * Get all unique countries from a list of jobs.
 * Returns sorted array of country names.
 */
export function getAllCountries(jobs: Array<{ location: string | null; isRemote: boolean }>): string[] {
  const countries = new Set<string>()

  for (const job of jobs) {
    const country = extractCountry(job.location)
    if (country) {
      countries.add(country)
    } else if (job.isRemote) {
      countries.add('Global/Remote')
    }
  }

  return Array.from(countries).sort()
}

/**
 * Trigger a browser download of a text file (cover letters, interview prep, CSV exports).
 * Creates a Blob and clicks a temporary anchor, then revokes the object URL.
 */
export function downloadFile(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Convert an HTML job description into clean, readable plain text, preserving
 * paragraph breaks and list bullets instead of collapsing to one run-on line.
 *
 * Safe to run on any string: with no tags present it only decodes entities and
 * normalizes whitespace, so it is idempotent over already-cleaned descriptions.
 * Pure string operations — usable on both server (ingest) and client (display).
 */
export function htmlToText(html: string): string {
  if (!html) return ''
  let text = html

  // Decode common entities BEFORE stripping tags — providers like Arbeitnow
  // HTML-encode the markup inside JSON (&lt;div&gt;…), so decoding first lets the
  // tag-strip below actually see the tags.
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ', '&ensp;': ' ', '&emsp;': ' ',
    '&hellip;': '…', '&mdash;': '—', '&ndash;': '–', '&rsquo;': "'", '&lsquo;': '‘',
    '&ldquo;': '“', '&rdquo;': '”', '&raquo;': '»', '&laquo;': '«', '&bull;': '•',
    '&middot;': '·', '&reg;': '®', '&copy;': '©', '&eacute;': 'é', '&egrave;': 'è',
  }
  text = text.replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, m => {
    const lower = m.toLowerCase()
    if (entities[lower]) return entities[lower]
    if (lower.startsWith('&#x')) return String.fromCharCode(parseInt(lower.slice(3), 16))
    if (lower.startsWith('&#')) return String.fromCharCode(parseInt(lower.slice(2), 10))
    return m
  })

  // Block-level closes become paragraph breaks; <br>/<hr> become line breaks.
  text = text.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|ul|ol|section|article|blockquote|tr|table|header|footer|figcaption)>/gi, '\n')
  text = text.replace(/<(br|hr)\s*\/?>/gi, '\n')
  // List items become bullets.
  text = text.replace(/<li[^>]*>/gi, '\n• ')

  // Drop everything else that looks like a tag (open tags, attributes, scripts).
  text = text.replace(/<[^>]*>/g, ' ')

  // Collapse spaces/tabs, keep single newlines, cap runs of blank lines.
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\s*\n\s*/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')

  // Trim per line and overall.
  return text.split('\n').map(l => l.trim()).join('\n').trim()
}