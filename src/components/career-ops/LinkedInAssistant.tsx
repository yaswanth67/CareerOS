'use client'

import { useState, useCallback } from 'react'
import { Copy, Send, Loader2, UserCheck, MessageSquare, Link2, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/Toast'
import { CareerOpsMarkdown } from '@/components/career-ops/CareerOpsReport'

interface LinkedInProfile {
  name: string
  headline: string
  company: string
  location: string
  about?: string
  posts?: Array<{ text: string; date: string }>
}

interface MessageResult {
  type: 'referral' | 'casual' | 'connection'
  markdown: string
}

const MESSAGE_TYPES = [
  { id: 'referral', label: 'Referral Request', icon: UserCheck, description: 'Ask for a referral to a specific role' },
  { id: 'casual', label: 'Casual Chat', icon: MessageSquare, description: 'Networking coffee chat / informational interview' },
  { id: 'connection', label: 'Connection Request', icon: Link2, description: 'Personalized connection note (300 chars max)' },
] as const

export function LinkedInAssistant() {
  const { toast } = useToast()
  const [profileUrl, setProfileUrl] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [selectedType, setSelectedType] = useState<'referral' | 'casual' | 'connection'>('referral')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MessageResult | null>(null)
  const [profilePreview, setProfilePreview] = useState<LinkedInProfile | null>(null)

  const validateLinkedInUrl = (url: string): boolean => {
    try {
      const u = new URL(url)
      return u.hostname === 'www.linkedin.com' || u.hostname === 'linkedin.com'
    } catch {
      return false
    }
  }

  const validateJobUrl = (url: string): boolean => {
    if (!url.trim()) return true // optional
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const extractProfileId = (url: string): string | null => {
    // Extract profile identifier from various LinkedIn URL formats
    // https://www.linkedin.com/in/username
    // https://www.linkedin.com/in/username/
    // https://www.linkedin.com/in/username?...
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
    return match ? match[1] : null
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedProfile = profileUrl.trim()
    const trimmedJob = jobUrl.trim()

    if (!trimmedProfile) {
      toast({ type: 'error', message: 'Paste a LinkedIn profile URL first.' })
      return
    }
    if (!validateLinkedInUrl(trimmedProfile)) {
      toast({ type: 'error', message: 'Please enter a valid LinkedIn profile URL (linkedin.com/in/...)' })
      return
    }
    if (selectedType === 'referral' && !trimmedJob) {
      toast({ type: 'error', message: 'For referral requests, please provide the job posting URL.' })
      return
    }
    if (trimmedJob && !validateJobUrl(trimmedJob)) {
      toast({ type: 'error', message: 'Please enter a valid job posting URL.' })
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/career-ops/linkedin-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileUrl: trimmedProfile,
          jobUrl: trimmedJob || undefined,
          messageType: selectedType,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok && data.message?.markdown) {
        setResult({
          type: selectedType,
          markdown: data.message.markdown,
        })
        setProfilePreview(data.profile || null)
        toast({ type: 'success', message: `${MESSAGE_TYPES.find(t => t.id === selectedType)?.label} generated!` })
      } else {
        setError(data?.error || 'Failed to generate message')
        toast({ type: 'error', message: data?.error || 'Failed to generate message' })
      }
    } catch {
      setError('Something went wrong. Try again.')
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.markdown)
      toast({ type: 'success', message: 'Copied to clipboard!' })
    } catch {
      toast({ type: 'error', message: 'Could not copy — select and copy manually' })
    }
  }

  const handleRegenerate = () => {
    setResult(null)
    setProfilePreview(null)
  }

  const handleTypeChange = (type: 'referral' | 'casual' | 'connection') => {
    setSelectedType(type)
    setResult(null)
    setProfilePreview(null)
    // Clear job URL when switching away from referral
    if (type !== 'referral') {
      setJobUrl('')
    }
  }

  const currentTypeInfo = MESSAGE_TYPES.find(t => t.id === selectedType)

  return (
    <div className="space-y-4">
      {/* Form */}
      <form onSubmit={handleGenerate} className="space-y-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary-500" />
            LinkedIn Profile
          </h3>
          <div>
            <Label htmlFor="profileUrl" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              LinkedIn Profile URL
            </Label>
            <Input
              id="profileUrl"
              type="url"
              placeholder="https://www.linkedin.com/in/username"
              value={profileUrl}
              onChange={e => setProfileUrl(e.target.value)}
              className="mt-1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Paste a public LinkedIn profile URL. We'll fetch their headline, company, and recent activity to personalize the message.
            </p>
          </div>

          {/* Job URL (required for referral) */}
          {(selectedType === 'referral') && (
            <div>
              <Label htmlFor="jobUrl" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-warning-500" />
                Job Posting URL <span className="text-danger-500">(required for referral)</span>
              </Label>
              <Input
                id="jobUrl"
                type="url"
                placeholder="https://boards.greenhouse.io/company/jobs/1234567"
                value={jobUrl}
                onChange={e => setJobUrl(e.target.value)}
                className="mt-1"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Provide the specific role you'd like a referral for. Works with Greenhouse, Ashby, Lever, company careers pages.
              </p>
            </div>
          )}

          {/* Message Type Selector */}
          <div>
            <Label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message Type
            </Label>
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleTypeChange(type.id)}
                  disabled={loading}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                    selectedType === type.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <type.icon className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{type.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {currentTypeInfo?.description}
            </p>
          </div>

          <Button type="submit" isLoading={loading} disabled={loading} className="w-full sm:w-auto">
            {!loading && <Send className="w-4 h-4 mr-2" />}
            {loading ? 'Generating…' : `Generate ${currentTypeInfo?.label}`}
          </Button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          This uses AI to analyze the profile and craft a personalized message. No data is stored — everything runs in-memory.
        </p>
      </form>

      {/* Loading */}
      {loading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex items-start gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-white">Analyzing profile and drafting message…</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This fetches the profile data and generates a personalized outreach message.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg border border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Profile Preview */}
          {profilePreview && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">{profilePreview.name}</h4>
                  <p className="text-sm text-primary-600 dark:text-primary-400 truncate">{profilePreview.headline}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{profilePreview.company} · {profilePreview.location}</p>
                  {profilePreview.about && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{profilePreview.about}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Generated Message */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary-500" />
                {currentTypeInfo?.label}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRegenerate}>
                  <X className="w-4 h-4 mr-1.5" />
                  Regenerate
                </Button>
              </div>
            </div>
            <CareerOpsMarkdown markdown={result.markdown} />
          </div>

          {/* Tips */}
          <div className="rounded-lg border border-info-200 dark:border-info-500/30 bg-info-50 dark:bg-info-500/10 p-4 text-sm text-info-700 dark:text-info-300">
            <p className="font-medium flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              Tips for better response rates
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
              <li>Personalize further — mention a specific post or project of theirs</li>
              <li>Keep it concise — busy professionals skim messages</li>
              <li>For referrals: make it easy for them (attach resume, role link)</li>
              <li>Follow up once if no response after 1 week</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}