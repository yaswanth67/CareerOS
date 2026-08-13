'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { FileText, Trash2, Eye, Pencil, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EditResumeModal, type EditableResume } from '@/components/resumes/EditResumeModal'
import { ViewResumeModal } from '@/components/resumes/ViewResumeModal'
import { formatDate } from '@/lib/utils'
import { ParsedResume, RoleType } from '@/types'
import { useToast } from '@/components/ui/Toast'

interface Resume {
  id: string
  title: string
  roleType: RoleType
  fileName: string
  filePath: string
  parsedText: string
  skills: string[]
  experience: ParsedResume['experience']
  education: ParsedResume['education']
  createdAt: string
  updatedAt: string
  _count?: { matches: number; applications: number }
}

const roleLabels: Record<RoleType, string> = {
  SDE: 'Software Engineer',
  AI_ENGINEER: 'AI Engineer',
  ML_ENGINEER: 'ML Engineer',
  DATA_SCIENTIST: 'Data Scientist',
  DATA_ENGINEER: 'Data Engineer',
  DEVOPS: 'DevOps',
  SRE: 'SRE',
  FULLSTACK: 'Full Stack',
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  MOBILE: 'Mobile',
  EMBEDDED: 'Embedded',
  SECURITY: 'Security',
  QA: 'QA',
  PM: 'Product Manager',
  OTHER: 'Other',
}

const SECTION_HEADERS = ['PROFILE', 'PROFESSIONAL SUMMARY', 'SUMMARY', 'WORK EXPERIENCE', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'PROJECTS', 'PUBLICATIONS', 'CERTIFICATIONS', 'AWARDS']

function getResumeSection(text: string, names: string[]) {
  const header = names.join('|')
  const allHeaders = SECTION_HEADERS.join('|')
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${header})\\s*(?:\\n|$)([\\s\\S]*?)(?=(?:^|\\n)\\s*(?:${allHeaders})\\s*(?:\\n|$)|$)`, 'im'))
  if (match?.[1].trim()) return match[1].trim()

  // PDF text extraction often removes every line break. Fall back to finding
  // all-caps section labels within the text so those resumes stay readable too.
  const start = new RegExp(`\\b(?:${header})\\b`).exec(text)
  if (!start) return ''
  const contentStart = (start.index ?? 0) + start[0].length
  const remainder = text.slice(contentStart)
  const next = new RegExp(`\\b(?:${allHeaders})\\b`).exec(remainder)
  return remainder.slice(0, next?.index ?? remainder.length).trim()
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    // Some PDFs extract acronyms one character per line (e.g. "L L M" / "P C O S").
    .replace(/(?:\b[A-Z]\s+){2,}[A-Z](?=(?:\s|[-&])|$)/g, acronym => acronym.replace(/\s/g, ''))
    .replace(/\b([A-Z])\s*&\s*([A-Z])\b/g, '$1&$2')
    .replace(/([A-Za-z])-\s+(?=[A-Z])/g, '$1-')
    .replace(/([a-z])(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/g, '$1 ')
    .trim()
}

function readableParagraphs(text: string) {
  const normalized = normalizeExtractedText(text)
  return normalized.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean)
}

function splitPortfolioEntries(text: string, type: 'projects' | 'publications') {
  const normalized = normalizeExtractedText(text)
  // Entry headings must begin at the section start or after the previous
  // entry's final sentence. This avoids treating every capitalized word before
  // a technology pipe (e.g. LLM-Powered Document Q&A Assistant) as an entry.
  const entryPattern = type === 'projects'
    ? /(?:^|(?<=\.\s))([A-Z][^|]{3,120}\|(?=[\s\S]{0,200}?\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b))/g
    : /(?:^|(?<=\.\s))([A-Z][\s\S]{3,160}?\s+(?:Springer|IEEE|ACM|Scopus))/g
  const starts = Array.from(normalized.matchAll(entryPattern)).map(match => {
    const heading = match[1] || ''
    return (match.index ?? 0) + match[0].length - heading.length
  })

  if (!starts.length) return normalized ? [normalized] : []
  return starts.map((start, index) => normalized.slice(start, starts[index + 1]).trim()).filter(Boolean)
}

function splitExperienceEntries(text: string) {
  const normalized = readableParagraphs(text).join(' ')
  const dateRange = String.raw`(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[-–]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|Present|Current)`
  // A position begins with its title, but it becomes a real experience entry
  // only when its start/end (or current) date is found after the employer.
  const positionStart = new RegExp(
    String.raw`\b(?:[A-Z][A-Za-z&.-]*\s+){0,4}(?:Engineer|Developer|Assistant|Intern|Scientist|Analyst|Architect|Manager|Consultant|Designer|Researcher)\b(?=[\s\S]{0,160}?\b${dateRange}\b)`,
    'g'
  )
  const starts = Array.from(normalized.matchAll(positionStart)).map(match => match.index ?? 0)

  if (!starts.length) return normalized ? [normalized] : []
  return starts.map((start, index) => normalized.slice(start, starts[index + 1]).trim()).filter(Boolean)
}

function splitEntryHeading(entry: string) {
  const date = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[-–]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|Present|Current)\b/i.exec(entry)
  if (!date || date.index == null) return { heading: '', details: entry }
  const end = date.index + date[0].length
  return { heading: entry.slice(0, end), details: entry.slice(end).trim() }
}

function splitEducationEntries(text: string) {
  const education = normalizeExtractedText(getResumeSection(text, ['EDUCATION']))
  return education
    .split(/(?=\b(?:Master(?:'s)?|Bachelor(?:'s)?|B\.?Tech|M\.?Tech|B\.?S\.?|M\.?S\.?|Ph\.?D\.?|MBA)\b)/i)
    .map(entry => entry.trim())
    .filter(Boolean)
}

export default function ResumesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingResume, setEditingResume] = useState<Resume | null>(null)

  // The dialog renders at page root, so it looks the open resume up by id
  // rather than being nested in that resume's card.
  const viewingResume = resumes.find(r => r.id === expandedId) ?? null

  useEffect(() => {
    if (!session) return

    let cancelled = false
    fetch('/api/resumes')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to load resumes'))))
      .then(data => {
        if (!cancelled) setResumes(data.resumes || [])
      })
      .catch(() => {
        if (!cancelled) toast({ type: 'error', message: 'Failed to load resumes' })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume?')) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setResumes(resumes.filter(r => r.id !== id))
        toast({ type: 'success', message: 'Resume deleted' })
      } else {
        toast({ type: 'error', message: 'Failed to delete resume' })
      }
    } catch {
      toast({ type: 'error', message: 'Failed to delete resume' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaved = (updated: EditableResume) => {
    setResumes(resumes.map(r =>
      r.id === updated.id
        ? { ...r, title: updated.title, roleType: updated.roleType, skills: updated.skills }
        : r
    ))
    setEditingResume(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-khaki-900">My Resumes</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage your tailored resumes for different role types
          </p>
        </div>
        <Link href="/resumes/new">
          <Button>
            <Plus className="w-4 h-4" />
            Upload New Resume
          </Button>
        </Link>
      </div>

      {resumes.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-khaki-900">No resumes yet</h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Upload your first resume to start matching with jobs
          </p>
          <Link href="/resumes/new" className="mt-4 inline-block">
            <Button>
              <Plus className="w-4 h-4" />
              Upload Resume
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <Card key={resume.id} className="card-hover">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-khaki-900">
                      {resume.title}
                    </h3>
                    <Badge variant="info" className="mt-1">
                      {roleLabels[resume.roleType] || resume.roleType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === resume.id ? null : resume.id)}
                      title={expandedId === resume.id ? 'Hide resume' : 'View resume'}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingResume(resume)}
                      title="Edit resume"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(resume.id)}
                      disabled={deletingId === resume.id}
                      className="text-danger-500 hover:text-danger-600"
                    >
                      {deletingId === resume.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {resume.fileName}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {resume.skills.slice(0, 6).map((skill) => (
                    <Badge key={skill} variant="gray" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {resume.skills.length > 6 && (
                    <Badge variant="gray" className="text-xs">
                      +{resume.skills.length - 6} more
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span>Created {formatDate(resume.createdAt)}</span>
                  <span className="flex items-center gap-1.5">
                    {resume._count?.matches && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        {resume._count.matches}
                      </span>
                    )}
                    {resume._count?.applications && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {resume._count.applications}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewingResume && (
        <ViewResumeModal
          resume={viewingResume}
          roleLabel={roleLabels[viewingResume.roleType] || viewingResume.roleType}
          onClose={() => setExpandedId(null)}
          onEdit={() => {
            setEditingResume(viewingResume)
            setExpandedId(null)
          }}
          sections={{
            getResumeSection,
            splitExperienceEntries,
            splitEntryHeading,
            splitEducationEntries,
            splitPortfolioEntries,
            readableParagraphs,
          }}
        />
      )}

      {editingResume && (
        <EditResumeModal
          resume={editingResume}
          onClose={() => setEditingResume(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
