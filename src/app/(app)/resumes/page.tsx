'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { FileText, Trash2, Eye, Pencil, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EditResumeModal, type EditableResume } from '@/components/resumes/EditResumeModal'
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

export default function ResumesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingResume, setEditingResume] = useState<Resume | null>(null)

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Resumes</h1>
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No resumes yet</h3>
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
                    <h3 className="font-semibold text-gray-900 dark:text-white">
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
                      title={expandedId === resume.id ? 'Hide parsed details' : 'Show parsed details'}
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

                {expandedId === resume.id && (
                  <div className="mb-4 space-y-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 p-4 animate-in">
                    {resume.skills.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          All Skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {resume.skills.map((skill, i) => (
                            <Badge key={i} variant="gray" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {resume.experience.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          Experience
                        </p>
                        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          {resume.experience.slice(0, 5).map((exp, i) => (
                            <li key={i}>
                              • {exp.role} @ {exp.company} ({exp.duration})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {resume.education.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          Education
                        </p>
                        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          {resume.education.slice(0, 5).map((edu, i) => (
                            <li key={i}>
                              • {edu.degree}, {edu.school} ({edu.year})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

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