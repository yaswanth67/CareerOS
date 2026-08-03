'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ExternalLink, CheckCircle2, Clock, Loader2, MapPin, Building2, DollarSign, Star, Target } from 'lucide-react'
import { formatRelativeTime, getScoreColor, getScoreLabel, getRoleLabel, getExperienceLabel } from '@/lib/utils'
import { RoleType, ExperienceLevel } from '@/types'
import toast from 'react-hot-toast'

const STATUS_META: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray' }> = {
  SAVED: { label: 'Saved', variant: 'gray' },
  APPLIED: { label: 'Applied', variant: 'info' },
  INTERVIEWING: { label: 'Interviewing', variant: 'warning' },
  OFFER: { label: 'Offer', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'gray' },
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  isRemote: boolean
  description: string
  skills: string[]
  experienceLevel: ExperienceLevel
  roleType: RoleType
  salaryMin?: number
  salaryMax?: number
  applyUrl: string
  postedAt: Date
  provider: string
  match?: {
    score: number
    reasoning: string
    matchedSkills: string[]
    missingSkills: string[]
  }
  applications?: { id: string; status: string }[]
}

interface JobCardProps {
  job: Job
  /** The user's most recent resume — required to save an application */
  defaultResumeId?: string | null
  /** Current application status for this job, if the user has saved it */
  savedStatus?: string | null
}

export function JobCard({ job, defaultResumeId, savedStatus }: JobCardProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const score = job.match?.score || 0
  const hasMatch = !!job.match

  const handleSave = async () => {
    if (!defaultResumeId) {
      toast.error('Upload a resume first to save jobs')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, resumeId: defaultResumeId, status: 'SAVED' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('Job saved — track it under Applications')
        router.refresh()
      } else {
        toast.error(data?.error || 'Failed to save job')
      }
    } catch {
      toast.error('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {job.title}
            </h3>
            {/* Role + score row — role always fully visible */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="gray" className="flex-shrink-0">
                <Building2 className="w-3 h-3 mr-1" />
                {getRoleLabel(job.roleType)}
              </Badge>
              {hasMatch ? (
                <Badge className={getScoreColor(score)} title={getScoreLabel(score)}>
                  <Target className="w-3 h-3 mr-1" />
                  {score}%
                </Badge>
              ) : (
                <Badge variant="gray" className="flex-shrink-0">
                  <Target className="w-3 h-3 mr-1" />
                  No match
                </Badge>
              )}
            </div>
            <p className="text-primary-600 dark:text-primary-400 font-medium truncate">
              {job.company}
            </p>
          </div>
          {job.provider && (
            <Badge variant="gray" className="flex-shrink-0">
              {job.provider}
            </Badge>
          )}
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {job.isRemote ? 'Remote' : job.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" />
            {getExperienceLabel(job.experienceLevel)}
          </span>
          {job.salaryMin || job.salaryMax ? (
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              ${job.salaryMin ? `${(job.salaryMin / 1000).toFixed(0)}k` : '?'} - ${job.salaryMax ? `${(job.salaryMax / 1000).toFixed(0)}k` : '?'}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatRelativeTime(job.postedAt)}
          </span>
        </div>

        {/* Match Details */}
        {hasMatch && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {job.match?.reasoning}
            </p>
            {job.match?.matchedSkills.length && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.match.matchedSkills.slice(0, 6).map((skill) => (
                  <Badge key={skill} variant="success" className="text-xs">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                    {skill}
                  </Badge>
                ))}
                {job.match.matchedSkills.length > 6 && (
                  <Badge variant="gray" className="text-xs">
                    +{job.match.matchedSkills.length - 6} more
                  </Badge>
                )}
              </div>
            )}
            {job.match?.missingSkills.length && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Missing: {job.match.missingSkills.slice(0, 4).join(', ')}
                {job.match.missingSkills.length > 4 && '...'}
              </p>
            )}
          </div>
        )}

        {/* Skills */}
        {job.skills.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {job.skills.slice(0, 8).map((skill) => (
              <Badge key={skill} variant="gray" className="text-xs">
                {skill}
              </Badge>
            ))}
            {job.skills.length > 8 && (
              <Badge variant="gray" className="text-xs">
                +{job.skills.length - 8} more
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(job.applyUrl, '_blank', 'noopener,noreferrer')}
            className="flex-1 sm:flex-none"
            disabled={!job.applyUrl}
            title={job.applyUrl ? 'Open application page' : 'No application link available'}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Apply
          </Button>
          {defaultResumeId &&
            (savedStatus ? (
              <Badge
                variant={STATUS_META[savedStatus]?.variant ?? 'gray'}
                className="flex-shrink-0 py-1.5 px-2.5"
                title={`This job is ${(STATUS_META[savedStatus]?.label ?? savedStatus).toLowerCase()} — manage it under Applications`}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {STATUS_META[savedStatus]?.label ?? savedStatus.toLowerCase()}
              </Badge>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                {saving ? 'Saving...' : 'Save'}
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}