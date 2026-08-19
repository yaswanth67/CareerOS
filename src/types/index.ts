// NOTE: Prisma with SQLite does not support database enums, so these types are
// string-literal unions shared across the app. Keep them in sync with the values
// used in the seed script and job providers.

export type RoleType =
  | 'SDE'
  | 'AI_ENGINEER'
  | 'ML_ENGINEER'
  | 'DATA_SCIENTIST'
  | 'DATA_ENGINEER'
  | 'DEVOPS'
  | 'SRE'
  | 'FULLSTACK'
  | 'FRONTEND'
  | 'BACKEND'
  | 'MOBILE'
  | 'EMBEDDED'
  | 'SECURITY'
  | 'QA'
  | 'OTHER'

export type JobProvider =
  | 'GREENHOUSE'
  | 'ASHBY'
  | 'LEVER'
  | 'COMPANY_DIRECT'
  | 'WELLFOUND'
  | 'REMOTIVE'
  | 'REMOTEOK'
  | 'ARBEITNOW'
  | 'JOBICY'
  | 'HACKERNEWS'
  | 'BUILTIN'
  | 'DICE'
  | 'OTHER'

export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'STAFF' | 'PRINCIPAL'

export type AppStatus = 'SAVED' | 'APPLIED' | 'INTERVIEWING' | 'OFFER' | 'REJECTED' | 'WITHDRAWN'

// Extended types for API responses
export interface ParsedResume {
  skills: string[]
  experience: Array<{
    role: string
    company: string
    duration: string
    achievements: string[]
  }>
  education: Array<{
    degree: string
    school: string
    year: string
  }>
  projects: Array<{
    name: string
    description: string
    technologies: string[]
  }>
  certifications: string[]
}

export interface RawJob {
  externalId: string
  title: string
  company: string
  location: string
  isRemote: boolean
  description: string
  requirements: string[]
  skills: string[]
  experienceLevel: ExperienceLevel
  roleType: RoleType
  salaryMin?: number
  salaryMax?: number
  currency: string
  applyUrl: string
  postedAt: Date
  expiresAt?: Date
  /** null/undefined = not yet classified */
  visaSponsored?: boolean | null
}

export interface ParsedJob extends RawJob {
  provider: JobProvider
}

export interface MatchResult {
  score: number
  reasoning: string
  matchedSkills: string[]
  missingSkills: string[]
  recommendation: 'STRONG_MATCH' | 'GOOD_MATCH' | 'WEAK_MATCH' | 'NO_MATCH'
}

// Grouped interview-prep questions, shared between the AI generator and its
// offline fallback so the UI renders one shape regardless of the source.
export interface InterviewQuestion {
  question: string
  /** Why the interviewer likely cares / what a strong answer shows. */
  why?: string
}

export interface InterviewQuestionGroup {
  category: string
  questions: InterviewQuestion[]
}

export interface InterviewQuestionSet {
  groups: InterviewQuestionGroup[]
}

export interface JobFetchFilters {
  roleTypes?: RoleType[]
  locations?: string[]
  remoteOnly?: boolean
  experienceLevels?: ExperienceLevel[]
  keywords?: string[]
  limit?: number
}

export interface DashboardStats {
  totalJobs: number
  newJobsToday: number
  strongMatches: number
  applicationsCount: number
  applicationsByStatus: Record<AppStatus, number>
  topSkills: Array<{ skill: string; count: number }>
  jobsByRole: Record<RoleType, number>
  jobsByProvider: Record<JobProvider, number>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}