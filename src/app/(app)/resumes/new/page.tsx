'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, X, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { ParsedResume, RoleType } from '@/types'

type ParsedResumeData = ParsedResume & {
  title: string
  roleType: RoleType
  fileName: string
  filePath: string
  parsedText: string
}

export default function ResumeUploadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedResumeData | null>(null)
  const [step, setStep] = useState<'upload' | 'review' | 'complete'>('upload')
  const [isDragActive, setIsDragActive] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editRoleType, setEditRoleType] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({ type: 'error', message: 'File size must be less than 10MB' })
      return
    }
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/resumes', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setUploadProgress(100)
      setParsedData(data.resume)
      setEditTitle(data.resume.title || '')
      setEditRoleType(data.resume.roleType || 'SDE')
      setStep('review')
      toast({ type: 'success', message: 'Resume uploaded and parsed!' })
    } catch (error) {
      toast({ type: 'error', message: error instanceof Error ? error.message : 'Upload failed' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!parsedData) return

    try {
      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          roleType: editRoleType,
          fileName: parsedData.fileName,
          filePath: parsedData.filePath,
          parsedText: parsedData.parsedText,
          skills: parsedData.skills,
          experience: parsedData.experience,
          education: parsedData.education,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save resume')
      }

      toast({ type: 'success', message: 'Resume saved successfully!' })
      router.push('/resumes')
      router.refresh()
    } catch {
      toast({ type: 'error', message: 'Failed to save resume' })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (step === 'complete') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-12">
          <CheckCircle2 className="w-16 h-16 text-success-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Resume Uploaded!</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Your resume has been parsed and saved successfully.
          </p>
          <Button onClick={() => router.push('/resumes')} className="mt-6">
            View All Resumes
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Resume</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Upload your PDF, DOCX, or TXT resume. We&apos;ll parse it and extract your skills,
          experience, and education automatically.
        </p>
      </div>

      {step === 'upload' && (
        <Card className={isDragActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragActive(true)
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragActive(false)
              handleFile(e.dataTransfer.files?.[0])
            }}
            className="p-8 text-center border-2 border-dashed rounded-xl cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              Drag & drop your resume here
            </p>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              or click to browse
            </p>
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
              PDF, DOCX, or TXT · Max 10MB
            </p>
          </div>

          {selectedFile && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          <div className="p-4 pt-0">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="w-full"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading & Parsing... {uploadProgress}%
                </>
              ) : (
                'Upload & Parse Resume'
              )}
            </Button>
          </div>
        </Card>
      )}

      {step === 'review' && parsedData && (
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Review Parsed Data
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Resume Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Role Type</label>
                <select value={editRoleType} onChange={(e) => setEditRoleType(e.target.value)} className="input">
                  <option value="SDE">Software Engineer</option>
                  <option value="AI_ENGINEER">AI Engineer</option>
                  <option value="ML_ENGINEER">ML Engineer</option>
                  <option value="DATA_SCIENTIST">Data Scientist</option>
                  <option value="DATA_ENGINEER">Data Engineer</option>
                  <option value="DEVOPS">DevOps</option>
                  <option value="FULLSTACK">Full Stack</option>
                  <option value="FRONTEND">Frontend</option>
                  <option value="BACKEND">Backend</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Extracted Skills ({parsedData.skills?.length || 0})</label>
                <div className="flex flex-wrap gap-2">
                  {parsedData.skills?.slice(0, 15).map((skill: string) => (
                    <span key={skill} className="badge bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
                      {skill}
                    </span>
                  ))}
                  {parsedData.skills?.length > 15 && (
                    <span className="badge bg-gray-100 text-gray-600">
                      +{parsedData.skills.length - 15} more
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="label">Experience Entries ({parsedData.experience?.length || 0})</label>
                <div className="space-y-2">
                  {parsedData.experience?.slice(0, 3).map((exp, i) => (
                    <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                      <p className="font-medium">{exp.role}</p>
                      <p className="text-gray-500">{exp.company} · {exp.duration}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                Confirm & Save
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}