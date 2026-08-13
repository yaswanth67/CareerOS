'use client'

import { X, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { ParsedResume, RoleType } from '@/types'

export interface ViewableResume {
  id: string
  title: string
  roleType: RoleType
  fileName: string
  parsedText: string
  skills: string[]
  experience: ParsedResume['experience']
  education: ParsedResume['education']
  createdAt: string
}

interface ViewResumeModalProps {
  resume: ViewableResume
  roleLabel: string
  onClose: () => void
  onEdit: () => void
  /** Section parsers live on the resumes page; passed in rather than duplicated. */
  sections: {
    getResumeSection: (text: string, names: string[]) => string
    splitExperienceEntries: (text: string) => string[]
    splitEntryHeading: (entry: string) => { heading: string; details: string }
    splitEducationEntries: (text: string) => string[]
    splitPortfolioEntries: (text: string, type: 'projects' | 'publications') => string[]
    readableParagraphs: (text: string) => string[]
  }
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
      {children}
    </p>
  )
}

/**
 * Read-only resume preview. Shares its shell with EditResumeModal — same
 * backdrop, same `card` surface, same header treatment — so the two dialogs
 * feel like one family, but runs wider because it renders a full document.
 *
 * Lives at the page root rather than inside a resume Card on purpose: `Card`
 * animates and lifts on hover via `transform`, and a transformed ancestor
 * becomes the containing block for `position: fixed` children. Nested, this
 * dialog anchored to the card instead of the viewport, which is what pushed it
 * off-centre and clipped it.
 */
export function ViewResumeModal({ resume, roleLabel, onClose, onEdit, sections }: ViewResumeModalProps) {
  const {
    getResumeSection,
    splitExperienceEntries,
    splitEntryHeading,
    splitEducationEntries,
    splitPortfolioEntries,
    readableParagraphs,
  } = sections

  const summary = getResumeSection(resume.parsedText, ['PROFESSIONAL SUMMARY', 'SUMMARY'])
  const experienceText = getResumeSection(resume.parsedText, ['WORK EXPERIENCE', 'EXPERIENCE'])
  const validEducation = resume.education.filter(education => education.degree.length < 180)
  const fallbackEducation = splitEducationEntries(resume.parsedText)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={`Resume preview: ${resume.title}`}
    >
      <div
        className="w-full max-w-4xl card shadow-2xl animate-in flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {resume.title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {roleLabel} · {resume.fileName} · Created {formatDate(resume.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Edit resume"
              title="Edit resume"
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {resume.skills.length > 0 && (
            <section>
              <SectionHeading>Skills</SectionHeading>
              <div className="flex flex-wrap gap-1.5">
                {resume.skills.map((skill, i) => (
                  <Badge key={i} variant="gray" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </section>
          )}

          {summary && (
            <section>
              <SectionHeading>Summary</SectionHeading>
              <p className="text-sm leading-7 text-gray-700 dark:text-gray-300">{summary}</p>
            </section>
          )}

          {(resume.experience.length > 0 || experienceText) && (
            <section>
              <SectionHeading>Experience</SectionHeading>
              <div className="space-y-4">
                {resume.experience.length > 0 ? resume.experience.map((exp, i) => (
                  <article key={i} className="border-l-2 border-primary-300 dark:border-primary-800 pl-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{exp.role}</h4>
                      {exp.duration && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{exp.duration}</span>
                      )}
                    </div>
                    {exp.company && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{exp.company}</p>
                    )}
                    {exp.achievements?.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm leading-7 text-gray-700 dark:text-gray-300">
                        {exp.achievements.map((achievement, j) => <li key={j}>• {achievement}</li>)}
                      </ul>
                    )}
                  </article>
                )) : splitExperienceEntries(experienceText).map((entry, i) => {
                  const { heading, details } = splitEntryHeading(entry)
                  return (
                    <article key={i} className="border-l-2 border-primary-300 dark:border-primary-800 pl-3 text-sm leading-7 text-gray-700 dark:text-gray-300">
                      {heading && (
                        <h4 className="mb-1 font-semibold text-gray-900 dark:text-white">{heading}</h4>
                      )}
                      {readableParagraphs(details).map((paragraph, j) => <p key={j}>{paragraph}</p>)}
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {(validEducation.length > 0 || fallbackEducation.length > 0) && (
            <section>
              <SectionHeading>Education</SectionHeading>
              <div className="space-y-3">
                {validEducation.length > 0 ? validEducation.map((education, i) => (
                  <article key={i} className="border-l-2 border-primary-300 dark:border-primary-800 pl-3 text-sm">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{education.degree}</h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      {[education.school, education.year].filter(Boolean).join(' · ')}
                    </p>
                  </article>
                )) : fallbackEducation.map((education, i) => (
                  <article key={i} className="border-l-2 border-primary-300 dark:border-primary-800 pl-3 text-sm leading-7 text-gray-700 dark:text-gray-300">
                    {readableParagraphs(education).map((paragraph, j) => <p key={j}>{paragraph}</p>)}
                  </article>
                ))}
              </div>
            </section>
          )}

          {(['projects', 'publications'] as const).map(type => {
            const title = type === 'projects' ? 'Projects' : 'Publications'
            const entries = splitPortfolioEntries(getResumeSection(resume.parsedText, [title.toUpperCase()]), type)
            if (entries.length === 0) return null
            return (
              <section key={type}>
                <SectionHeading>{title}</SectionHeading>
                <div className="space-y-3">
                  {entries.map((entry, i) => (
                    <article key={i} className="border-l-2 border-primary-300 dark:border-primary-800 pl-3 text-sm leading-7 text-gray-700 dark:text-gray-300">
                      {readableParagraphs(entry).map((paragraph, j) => <p key={j}>{paragraph}</p>)}
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
