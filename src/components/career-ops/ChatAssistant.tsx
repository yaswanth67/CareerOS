'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Loader2, MessagesSquare, Send, User, FileText, Download, RotateCcw, Sparkles, Award, Zap, FileOutput, FileType } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/components/ui/Toast'
import { CareerOpsMarkdown } from '@/components/career-ops/CareerOpsReport'
import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, PageOrientation, convertInchesToTwip, Footer, Header, PageNumber, TabStopType, TabStopPosition, LevelFormat, Numbering } from 'docx'
import { saveAs } from 'file-saver'

interface ResumeOption {
  id: string
  title: string | null
  updatedAt: string
}

interface ResumesApiResponse {
  resumes: ResumeOption[]
}

interface ResumeRecommendation {
  resumeId: string
  title: string | null
  score: number
  reason: string
}

interface RecommendResponse {
  recommended: ResumeRecommendation | null
  allScores: ResumeRecommendation[]
}

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
}

const SUGGESTED_QUESTIONS = [
  'Walk me through your experience using AI on past projects.',
  'Why are you a strong fit for this role?',
  'Tell me about a time you solved a hard technical problem.',
]

// Interview-prep chat. The candidate sets a target role + picks a resume, then
// asks questions. The whole conversation is sent on every turn so the assistant
// keeps context; the resume + role are re-injected via the system prompt server-side.
export function ChatAssistant() {
  const { toast } = useToast()
  const [jobRole, setJobRole] = useState('')
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [resumesLoading, setResumesLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverLetter, setCoverLetter] = useState<string | null>(null)
  const [coverLetterLoading, setCoverLetterLoading] = useState(false)
  const [recommendation, setRecommendation] = useState<RecommendResponse | null>(null)
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [fastResume, setFastResume] = useState<string | null>(null)
  const [fastResumeLoading, setFastResumeLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchResumes = useCallback(async () => {
    setResumesLoading(true)
    try {
      const res = await fetch('/api/resumes/list')
      const data: ResumesApiResponse = await res.json().catch(() => ({ resumes: [] }))
      if (res.ok) {
        setResumes(data.resumes || [])
      }
    } catch {
      // Non-fatal: the user can still proceed if a resume exists.
    } finally {
      setResumesLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchResumes, 0)
    return () => clearTimeout(timer)
  }, [fetchResumes])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  if (resumesLoading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
          <div className="animate-pulse space-y-2">
            <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
        <div className="p-4 h-[420px] flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="animate-pulse space-y-3 text-center">
            <div className="h-8 w-3/4 mx-auto rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-1/2 mx-auto rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-1/3 mx-auto rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 animate-pulse">
          <div className="h-10 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    )
  }

  const sendMessage = async (text: string) => {
    const question = text.trim()
    if (!jobRole.trim()) {
      toast({ type: 'error', message: 'Enter a target job role first.' })
      return
    }
    if (!question) return

    const userMsg: ChatMessage = {
      id: `u-${messages.length}-${messages.length}`,
      role: 'user',
      content: question,
    }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/career-ops/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: jobRole.trim(),
          resumeId: selectedResumeId || undefined,
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.reply) {
        setMessages(prev => [
          ...prev,
          {
            id: `a-${prev.length}`,
            role: 'assistant',
            content: data.reply as string,
          },
        ])
      } else {
        setError(data?.error || 'Failed to get a response. Try again.')
        toast({ type: 'error', message: data?.error || 'Failed to get a response.' })
      }
    } catch {
      setError('Something went wrong. Try again.')
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    void sendMessage(input)
  }

  const clearChat = () => {
    setMessages([])
    setCoverLetter(null)
    setRecommendation(null)
    setError(null)
    toast({ type: 'success', message: 'Chat cleared' })
  }

  const generateCoverLetter = async () => {
    if (!jobRole.trim()) {
      toast({ type: 'error', message: 'Enter a target job role first.' })
      return
    }
    if (messages.length === 0) {
      toast({ type: 'error', message: 'Have a conversation first to give the cover letter context.' })
      return
    }

    setCoverLetterLoading(true)
    setCoverLetter(null)

    try {
      const res = await fetch('/api/career-ops/chat-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: jobRole.trim(),
          resumeId: selectedResumeId || undefined,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.coverLetter) {
        setCoverLetter(data.coverLetter)
        toast({ type: 'success', message: 'Cover letter generated!' })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to generate cover letter.' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setCoverLetterLoading(false)
    }
  }

  const downloadCoverLetterPDF = () => {
    if (!coverLetter) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - 2 * margin
    let y = margin

    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Cover Letter', pageWidth / 2, y, { align: 'center' })
    y += 10

    // Target role
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Target Role: ${jobRole}`, margin, y)
    y += 8

    // Date
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    doc.text(`Date: ${today}`, margin, y)
    y += 12

    // Horizontal line
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    // Cover letter content
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)

    const lines = doc.splitTextToSize(coverLetter, maxWidth)
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += 5
    }

    // Save
    const safeRole = jobRole.replace(/[^a-z0-9]/gi, '_')
    doc.save(`Cover_Letter_${safeRole}.pdf`)
    toast({ type: 'success', message: 'Cover letter downloaded as PDF' })
  }

  const recommendBestResume = async () => {
    if (!jobRole.trim()) {
      toast({ type: 'error', message: 'Enter a target job role first.' })
      return
    }
    if (resumes.length === 0) {
      toast({ type: 'error', message: 'No resumes found to evaluate.' })
      return
    }

    setRecommendLoading(true)
    setRecommendation(null)

    try {
      const res = await fetch('/api/career-ops/recommend-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: jobRole.trim(),
          resumeIds: resumes.map(r => r.id),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.recommended) {
        setRecommendation(data)
        // Auto-select the recommended resume
        setSelectedResumeId(data.recommended.resumeId)
        toast({ type: 'success', message: `Recommended: ${data.recommended.title || 'Untitled'} (${data.recommended.score}/5)` })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to get recommendation.' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setRecommendLoading(false)
    }
  }

  const generateFastResume = async () => {
    if (!jobRole.trim()) {
      toast({ type: 'error', message: 'Enter a target job role first.' })
      return
    }

    setFastResumeLoading(true)
    setFastResume(null)

    try {
      const res = await fetch('/api/career-ops/fast-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: jobRole.trim(),
          resumeId: selectedResumeId || undefined,
          jobDescription: messages.length > 0 ? messages.map(m => `${m.role}: ${m.content}`).join('\n\n') : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.markdown) {
        setFastResume(data.markdown)
        toast({ type: 'success', message: 'Fast resume generated! Click Download PDF to save.' })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to generate fast resume.' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setFastResumeLoading(false)
    }
  }

  const downloadFastResumePDF = () => {
    if (!fastResume) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - 2 * margin
    let y = margin

    // Parse markdown and render with basic formatting
    const lines = fastResume.split('\n')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)

    for (const rawLine of lines) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage()
        y = margin
      }

      const line = rawLine.trimEnd()
      if (!line) {
        y += 4
        continue
      }

      // Headers
      if (line.startsWith('### ')) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        const wrapped = doc.splitTextToSize(line.slice(4), maxWidth)
        for (const w of wrapped) {
          doc.text(w, margin, y)
          y += 6
        }
        y += 2
        continue
      }
      if (line.startsWith('## ')) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 30)
        const wrapped = doc.splitTextToSize(line.slice(3), maxWidth)
        for (const w of wrapped) {
          doc.text(w, margin, y)
          y += 7
        }
        // Underline for section headers
        doc.setDrawColor(100, 100, 100)
        doc.line(margin, y + 1, pageWidth - margin, y + 1)
        y += 6
        doc.setTextColor(0, 0, 0)
        continue
      }
      if (line.startsWith('# ')) {
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(20, 20, 20)
        const wrapped = doc.splitTextToSize(line.slice(2), maxWidth)
        for (const w of wrapped) {
          doc.text(w, margin, y)
          y += 9
        }
        y += 4
        doc.setTextColor(0, 0, 0)
        continue
      }

      // Bold items like **Languages:** or **Role — Company**
      if (line.startsWith('- ') || line.startsWith('• ')) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const bulletText = line.slice(2)
        const wrapped = doc.splitTextToSize(bulletText, maxWidth - 6)
        doc.text('•', margin + 2, y)
        for (let i = 0; i < wrapped.length; i++) {
          doc.text(wrapped[i], margin + 6, y + (i * 5))
        }
        y += wrapped.length * 5
        continue
      }

      // Bold inline handling for things like **Languages:** [...]
      if (line.includes('**')) {
        doc.setFontSize(10)
        // Simple handling: print the line
        const wrapped = doc.splitTextToSize(line.replace(/\*\*/g, ''), maxWidth)
        for (const w of wrapped) {
          doc.text(w, margin, y)
          y += 5
        }
        continue
      }

      // Regular text
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const wrapped = doc.splitTextToSize(line, maxWidth)
      for (const w of wrapped) {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage()
          y = margin
        }
        doc.text(w, margin, y)
        y += 5
      }
    }

    const safeRole = jobRole.replace(/[^a-z0-9]/gi, '_')
    doc.save(`Fast_Resume_${safeRole}.pdf`)
    toast({ type: 'success', message: 'Fast resume downloaded as PDF' })
  }

  const downloadFastResumeDOCX = () => {
    if (!fastResume) return

    const safeRole = jobRole.replace(/[^a-z0-9]/gi, '_')
    const lines = fastResume.split('\n')
    const children: Paragraph[] = []

    let i = 0
    while (i < lines.length) {
      const rawLine = lines[i]
      const line = rawLine.trimEnd()

      if (!line) {
        children.push(new Paragraph({ text: '', spacing: { after: 60 } }))
        i++
        continue
      }

      // Name header (# Name)
      if (line.startsWith('# ')) {
        const name = line.slice(2).trim()
        children.push(
          new Paragraph({
            children: [new TextRun({ text: name, bold: true, size: 32, font: 'Calibri', color: '1A1A1A' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 40, before: 0 },
          })
        )
        i++
        continue
      }

      // Section headers (## SECTION)
      if (line.startsWith('## ')) {
        const sectionTitle = line.slice(3).trim().toUpperCase()
        children.push(
          new Paragraph({
            children: [new TextRun({ text: sectionTitle, bold: true, size: 22, font: 'Calibri', color: '1A1A1A', allCaps: true })],
            spacing: { before: 200, after: 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2D2D2D' } },
          })
        )
        i++
        continue
      }

      // Sub-section headers (### Role — Company | Dates)
      if (line.startsWith('### ')) {
        const subTitle = line.slice(4).trim()
        children.push(
          new Paragraph({
            children: [new TextRun({ text: subTitle, bold: true, size: 22, font: 'Calibri', color: '2D2D2D' })],
            spacing: { before: 140, after: 60 },
          })
        )
        i++
        continue
      }

      // Bullet points (- or •)
      if (line.startsWith('- ') || line.startsWith('• ')) {
        const bulletText = line.slice(2).trim()
        // Handle bold inline: **Text:** rest
        const boldMatch = bulletText.match(/^\*\*(.+?)\*\*\s*(.*)$/)
        if (boldMatch) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '• ', size: 20, font: 'Calibri', color: '1A1A1A' }),
                new TextRun({ text: boldMatch[1], bold: true, size: 20, font: 'Calibri', color: '1A1A1A' }),
                new TextRun({ text: boldMatch[2], size: 20, font: 'Calibri', color: '1A1A1A' }),
              ],
              spacing: { after: 40, line: 276 },
              indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
            })
          )
        } else {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '• ', size: 20, font: 'Calibri', color: '1A1A1A' }),
                new TextRun({ text: bulletText, size: 20, font: 'Calibri', color: '1A1A1A' }),
              ],
              spacing: { after: 40, line: 276 },
              indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
            })
          )
        }
        i++
        continue
      }

      // Contact info line (Email | Phone | Location | LinkedIn | GitHub)
      if (line.includes('|') && (line.includes('@') || line.includes('linkedin') || line.includes('github') || line.includes('.com'))) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 20, font: 'Calibri', color: '4A4A4A' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          })
        )
        i++
        continue
      }

      // Bold inline handling for skill categories like **Languages:** [...]
      if (line.includes('**') && line.includes(':')) {
        const parts = line.split('**').filter(Boolean)
        const runs: TextRun[] = []
        for (let j = 0; j < parts.length; j++) {
          const isBold = j % 2 === 0 && parts[j].endsWith(':')
          if (isBold) {
            runs.push(new TextRun({ text: parts[j], bold: true, size: 20, font: 'Calibri', color: '1A1A1A' }))
          } else {
            runs.push(new TextRun({ text: parts[j], size: 20, font: 'Calibri', color: '1A1A1A' }))
          }
        }
        children.push(
          new Paragraph({
            children: runs,
            spacing: { after: 60, line: 276 },
          })
        )
        i++
        continue
      }

      // Regular text
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 20, font: 'Calibri', color: '1A1A1A' })],
          spacing: { after: 60, line: 276 },
        })
      )
      i++
    }

    // Create document with US Letter, 0.7" margins for one-page fit
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.6),
              bottom: convertInchesToTwip(0.6),
              left: convertInchesToTwip(0.7),
              right: convertInchesToTwip(0.7),
            },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        children,
      }],
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 20, color: '1A1A1A' },
            paragraph: { spacing: { line: 276 } },
          },
        },
      },
    })

    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, `Fast_Resume_${safeRole}.docx`)
      toast({ type: 'success', message: 'Fast resume downloaded as Word (.docx)' })
    }).catch(() => {
      toast({ type: 'error', message: 'Failed to generate Word document' })
    })
  }

  const hasConversation = messages.length > 0

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Controls: target role + resume version */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
        <div>
          <Label htmlFor="chatJobRole" className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Target job role
          </Label>
          <Input
            id="chatJobRole"
            value={jobRole}
            onChange={e => setJobRole(e.target.value)}
            placeholder="e.g. Senior Data Engineer"
            className="mt-1"
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 sm:max-w-xs">
            <Label htmlFor="chatResumeVersion" className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Resume version
            </Label>
            <select
              id="chatResumeVersion"
              value={selectedResumeId}
              onChange={e => setSelectedResumeId(e.target.value)}
              disabled={resumesLoading}
              className="mt-1 w-full appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Latest resume</option>
              {resumes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title || 'Untitled resume'} — {new Date(r.updatedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 sm:pb-2">
            Answers are framed for the role and grounded in this resume.
          </p>
        </div>
        {resumes.length === 0 && !resumesLoading && (
          <p className="text-xs text-warning-600 dark:text-warning-400">
            No resume found — upload one first so the assistant can ground its answers.
          </p>
        )}

        {/* Resume Recommendation + Cover Letter */}
        <div className="flex flex-wrap gap-2">
          {/* Recommend Best Resume */}
          {resumes.length > 1 && !recommendation && (
            <Button
              variant="outline"
              size="sm"
              onClick={recommendBestResume}
              disabled={recommendLoading || !jobRole.trim()}
              className="flex items-center justify-center gap-1.5"
            >
              {recommendLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{recommendLoading ? 'Analyzing…' : 'Recommend Best Resume'}</span>
            </Button>
          )}

          {/* Recommendation Result */}
          {recommendation?.recommended && (
            <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-lg border border-success-200 dark:border-success-500/30 bg-success-50 dark:bg-success-500/10 p-3">
              <Award className="w-4 h-4 text-success-600 dark:text-success-400 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-success-700 dark:text-success-300 truncate">
                  Recommended: {recommendation.recommended.title || 'Untitled resume'}
                </p>
                <p className="text-xs text-success-600 dark:text-success-400 truncate">
                  Match score: {recommendation.recommended.score}/5 — {recommendation.recommended.reason}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRecommendation(null)}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Change
              </Button>
            </div>
          )}

          {/* Generate Cover Letter - always present next to recommend, enabled when conversation exists */}
          <Button
            variant="outline"
            size="sm"
            onClick={generateCoverLetter}
            disabled={coverLetterLoading || !jobRole.trim() || !hasConversation}
            className="flex items-center gap-1.5"
          >
            {coverLetterLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{coverLetterLoading ? 'Generating…' : 'Generate Cover Letter'}</span>
          </Button>

          {/* Fast Resume - AI tailored resume optimized for 90%+ ATS & role match */}
          <Button
            variant="outline"
            size="sm"
            onClick={generateFastResume}
            disabled={fastResumeLoading || !jobRole.trim()}
            className="flex items-center gap-1.5"
          >
            {fastResumeLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{fastResumeLoading ? 'Generating…' : 'Fast Resume'}</span>
          </Button>
        </div>

        {/* Cover Letter Download + Clear Chat */}
        {hasConversation && coverLetter && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCoverLetterPDF}
              className="flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download PDF</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="flex items-center gap-1.5 ml-auto text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Chat</span>
            </Button>
          </div>
        )}

        {/* Clear Chat only (when no cover letter generated yet) */}
        {hasConversation && !coverLetter && (
          <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="flex items-center gap-1.5 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Chat</span>
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="p-4 h-[420px] overflow-y-auto space-y-4 bg-white dark:bg-gray-900">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
            <MessagesSquare className="w-8 h-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Ask an interview question for the role above. Try one of these:
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendMessage(q)}
                  disabled={!jobRole.trim() || loading}
                  className="text-left text-xs rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => (
            <div
              key={m.id}
              className={m.role === 'user' ? 'flex justify-end gap-2' : 'flex justify-start gap-2'}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                </div>
              )}
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-primary-500 text-white px-3.5 py-2.5 text-sm'
                    : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800 px-3.5 py-2.5'
                }
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                ) : (
                  <CareerOpsMarkdown markdown={m.content} />
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start gap-2">
            <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 dark:bg-gray-800 px-3.5 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" aria-hidden="true" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 px-3 py-2 text-sm text-danger-700 dark:text-danger-300">
            {error}
          </div>
        )}

        {/* Cover Letter Preview */}
        {coverLetter && (
          <div className="rounded-lg border border-info-200 dark:border-info-500/30 bg-info-50 dark:bg-info-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-500" />
                Generated Cover Letter
              </span>
              <Button variant="ghost" size="sm" onClick={downloadCoverLetterPDF}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download PDF
              </Button>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-gray-900 rounded p-3">
              <p className="whitespace-pre-wrap leading-relaxed">{coverLetter}</p>
            </div>
          </div>
        )}

        {/* Fast Resume Preview */}
        {fastResume && (
          <div className="rounded-lg border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <FileOutput className="w-4 h-4 text-purple-500" />
                Fast Resume (ATS Optimized)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={downloadFastResumeDOCX}>
                  <FileType className="w-3.5 h-3.5 mr-1.5" />
                  Download Word
                </Button>
                <Button variant="ghost" size="sm" onClick={downloadFastResumePDF}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download PDF
                </Button>
              </div>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap leading-relaxed text-xs font-mono">{fastResume}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={jobRole.trim() ? 'Ask your interview question…' : 'Set a target role above to start…'}
          disabled={!jobRole.trim() || loading}
          className="flex-1"
        />
        <Button type="submit" disabled={!jobRole.trim() || loading || !input.trim()} size="md">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
          <span className="ml-1.5 hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  )
}
