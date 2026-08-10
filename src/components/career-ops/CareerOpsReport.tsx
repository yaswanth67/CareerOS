'use client'

import { Copy } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'

// Result of a career-ops evaluation (returned by /api/career-ops/evaluate and
// /api/jobs/[id]/career-ops). Shared by the job-detail drawer and the Evaluate
// tab so both render the report identically.
export interface CareerOpsReportData {
  score: number | null
  archetype: string
  legitimacy: string
  markdown: string
}

// career-ops scores are on a 0–5 scale (vs the 0–100 match score elsewhere).
function careerScoreColor(score: number): string {
  if (score >= 4) return 'text-success-600 dark:text-success-400'
  if (score >= 3) return 'text-warning-600 dark:text-warning-400'
  return 'text-danger-600 dark:text-danger-400'
}

function legitimacyVariant(legitimacy: string): 'success' | 'warning' | 'danger' | 'info' {
  const l = legitimacy.toLowerCase()
  if (l.includes('high confidence')) return 'success'
  if (l.includes('caution')) return 'warning'
  if (l.includes('suspicious')) return 'danger'
  return 'info'
}

// The career-ops report is real markdown (headings, bold, lists, tables, yaml
// blocks) — render it properly instead of the plain-text pre-wrap used for prose.
// Also used by the Evaluate tab's career-ops modes (cover letter, interview prep,
// email, upskill, follow-up), which produce the same kind of markdown.
export function CareerOpsMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-gray-900 dark:text-white mt-3 mb-1.5">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mt-3 mb-1.5">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-2.5 mb-1">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-1.5">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-1.5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-2.5 border-gray-200 dark:border-gray-700" />,
          code: ({ className, children }) =>
            className?.includes('language-') ? (
              <code className={`font-mono text-xs ${className}`}>{children}</code>
            ) : (
              <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="my-2 p-3 rounded-md bg-gray-100 dark:bg-gray-800 overflow-x-auto text-xs text-gray-800 dark:text-gray-200">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-gray-300 dark:border-gray-600">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1.5 text-left font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wide">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 align-top">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-2 italic">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              className="text-primary-600 dark:text-primary-400 underline"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

/**
 * Self-contained career-ops evaluation card: score, archetype/legitimacy badges,
 * a copy button, and the full A–G report rendered as markdown. Used by both the
 * job-detail drawer and the Evaluate tab.
 */
export function CareerOpsReport({ report }: { report: CareerOpsReportData }) {
  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report.markdown)
      toast.success('Career Ops report copied')
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Career Ops evaluation</span>
        <div className="flex items-center gap-2">
          {report.score != null && (
            <span className={`text-sm font-bold ${careerScoreColor(report.score)}`}>
              {report.score}/5
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={copyReport}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {(report.archetype || report.legitimacy) && (
          <div className="flex flex-wrap gap-1.5">
            {report.archetype && <Badge variant="info">{report.archetype}</Badge>}
            {report.legitimacy && (
              <Badge variant={legitimacyVariant(report.legitimacy)}>{report.legitimacy}</Badge>
            )}
          </div>
        )}
        <CareerOpsMarkdown markdown={report.markdown} />
      </div>
    </div>
  )
}
