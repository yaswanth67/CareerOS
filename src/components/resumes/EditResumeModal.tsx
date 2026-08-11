'use client'

import { useState } from 'react'
import { X, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { RoleType } from '@/types'

const roleOptions: { value: RoleType; label: string }[] = [
  { value: 'SDE', label: 'Software Engineer' },
  { value: 'AI_ENGINEER', label: 'AI Engineer' },
  { value: 'ML_ENGINEER', label: 'ML Engineer' },
  { value: 'DATA_SCIENTIST', label: 'Data Scientist' },
  { value: 'DATA_ENGINEER', label: 'Data Engineer' },
  { value: 'DEVOPS', label: 'DevOps' },
  { value: 'SRE', label: 'SRE' },
  { value: 'FULLSTACK', label: 'Full Stack' },
  { value: 'FRONTEND', label: 'Frontend' },
  { value: 'BACKEND', label: 'Backend' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'EMBEDDED', label: 'Embedded' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'QA', label: 'QA' },
  { value: 'PM', label: 'Product Manager' },
  { value: 'OTHER', label: 'Other' },
]

export interface EditableResume {
  id: string
  title: string
  roleType: RoleType
  skills: string[]
}

interface EditResumeModalProps {
  resume: EditableResume
  onClose: () => void
  onSaved: (resume: EditableResume) => void
}

export function EditResumeModal({ resume, onClose, onSaved }: EditResumeModalProps) {
  const [title, setTitle] = useState(resume.title)
  const [roleType, setRoleType] = useState<RoleType>(resume.roleType)
  const [skills, setSkills] = useState<string[]>(resume.skills)
  const [skillInput, setSkillInput] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const addSkill = () => {
    const s = skillInput.trim()
    if (s && !skills.includes(s)) setSkills([...skills, s])
    setSkillInput('')
  }

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/resumes/${resume.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), roleType, skills }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      onSaved({ id: resume.id, title: title.trim(), roleType, skills })
      toast({ type: 'success', message: 'Resume updated' })
    } catch (error) {
      toast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to save changes' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-lg card shadow-2xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Resume</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <Label htmlFor="edit-title">Resume Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Software Engineer Resume"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="edit-role">Role Type</Label>
            <select
              id="edit-role"
              value={roleType}
              onChange={(e) => setRoleType(e.target.value as RoleType)}
              className="input mt-1"
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {skills.map((skill) => (
                <Badge key={skill} variant="gray" className="flex items-center gap-1.5">
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="hover:text-gray-500"
                    aria-label={`Remove ${skill}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {skills.length === 0 && (
                <span className="text-sm text-gray-400">No skills added yet</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSkill()
                  }
                }}
                placeholder="Add a skill and press Enter"
              />
              <Button type="button" variant="secondary" onClick={addSkill}>
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
