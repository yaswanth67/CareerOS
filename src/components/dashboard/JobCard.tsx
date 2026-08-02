'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ExternalLink, CheckCircle2, Clock, MapPin, Building2, DollarSign, Star, Target } from 'lucide-react'
import { formatRelativeTime, getScoreColor } from '@/lib/utils'
import { RoleType, ExperienceLevel } from '@/types'

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
}

interface JobCardProps {
  job: Job
  onApply?: (jobId: string) => void
}

export function JobCard({ job, onApply }: JobCardProps) {
  const score = job.match?.score || 0
  const hasMatch = !!job.match

  return (
    <Card className="card-hover overflow-hidden">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {job.title}
              </h3>
              {hasMatch && (
                <Badge className={getScoreColor(score)}>
                  <Target className="w-3 h-3 mr-1" />
                  {score}%
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
            {job.experienceLevel}
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {job.roleType}
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
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Apply
          </Button>
          {onApply && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onApply(job.id)}
              className="flex-1 sm:flex-none"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Save
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}