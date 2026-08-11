import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { CareerOpsReport } from './index'

// Next's bundler statically analyzes `import(...)` and rejects a computed
// specifier ("expression is too dynamic"), so the real tool's ESM module —
// which lives outside src/ and is deliberately not bundled — must be loaded
// through an import the bundler can't see. `new Function` bodies are opaque to
// it, so the `import()` inside runs as a genuine Node runtime import.
const runtimeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<Record<string, unknown>>

// Make an evaluated job "registered" in the career-ops workspace, the same way
// the real tool does: allocate the next report number through career-ops' own
// atomic allocator, write the A–G report to `reports/{num}-{company}-{date}.md`,
// and append a row to the tracker (`data/applications.md`). The report file is
// then usable by the career-ops CLI itself (e.g. `career-ops apply <num>`).

const TRACKER_HEADER =
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n' +
  '|---|------|---------|------|-------|--------|-----|--------|-------|\n'

export interface PersistOptions {
  /** Absolute path to the career-ops workspace root. */
  rootDir: string
  /** Posting URL — recorded in the report header. */
  url?: string
}

export interface PersistResult {
  /** Absolute path to the saved report file, or null on failure. */
  reportPath: string | null
  /** Allocated report number, or null on failure. */
  reportNumber: number | null
  error?: string
}

/** slugify the company name for the report filename (career-ops convention). */
function slugify(name: string): string {
  return (name || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'company'
}

/** Escape a tracker cell so pipes/newlines can't break the markdown table. */
function cell(value: string): string {
  return (value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
}

/** Render the tracker's Score cell ("2.0/5") from the parsed report score. */
function scoreCell(report: CareerOpsReport): string {
  if (report.score != null && Number.isFinite(report.score)) {
    return `${report.score.toFixed(1)}/5`
  }
  const m = report.markdown.match(/(?:score|puntuaci[oó]n)[^\d]*(\d+(?:\.\d+)?)/i)
  return m ? `${m[1]}/5` : ''
}

/**
 * Save a finished evaluation into the career-ops workspace (report file +
 * tracker row). Best-effort: returns `{ reportPath: null, error }` instead of
 * throwing so a persistence hiccup never discards the score itself.
 */
export async function persistCareerOpsReport(
  report: CareerOpsReport,
  options: PersistOptions
): Promise<PersistResult> {
  const { rootDir, url } = options
  const reportsDir = join(rootDir, 'reports')

  // Load career-ops' own atomic number allocator at runtime (it's plain ESM
  // living outside src/, so a computed dynamic import keeps Next from bundling it).
  let allocator: {
    reserveReportNumbers: (count: number, opts: { rootDir: string; reportsDir: string }) => Promise<number[]>
    releaseReportNumbers: (nums: number[], opts: { reportsDir: string }) => Promise<void>
    formatReportNumber: (n: number) => string
  }
  try {
    allocator = (await runtimeImport(
      pathToFileURL(join(rootDir, 'reserve-report-num.mjs')).href
    )) as typeof allocator
  } catch (error) {
    return { reportPath: null, reportNumber: null, error: 'career-ops workspace is missing reserve-report-num.mjs' }
  }

  let numbers: number[]
  try {
    numbers = await allocator.reserveReportNumbers(1, { rootDir, reportsDir })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return { reportPath: null, reportNumber: null, error: `Could not reserve a report number: ${message}` }
  }
  const num = numbers[0]

  try {
    const today = new Date().toISOString().split('T')[0]
    const slug = slugify(report.company)
    const numStr = allocator.formatReportNumber(num)
    const fileName = `${numStr}-${slug}-${today}.md`
    const reportPath = join(reportsDir, fileName)

    // Report header matches the real tool (URL + legitimacy line before the A–G body).
    const legitimacy = report.legitimacy ? `**Legitimacy:** ${report.legitimacy}` : '**Legitimacy:** unconfirmed'
    const urlLine = url ? `**URL:** ${url}` : '**URL:** (pasted)'
    await mkdir(reportsDir, { recursive: true })
    await writeFile(reportPath, `${urlLine}\n${legitimacy}\n\n${report.markdown}\n`, 'utf-8')

    // Register in the tracker (modern data/ layout). Row links back to the report
    // relative to the tracker's directory, matching merge-tracker's normalization.
    const trackerPath = join(rootDir, 'data', 'applications.md')
    const row =
      `| ${num} | ${today} | ${cell(report.company)} | ${cell(report.role)} | ${scoreCell(report)} | Evaluated | ❌ | ` +
      `[${numStr}](../reports/${fileName}) |  |\n`
    if (existsSync(trackerPath)) {
      const existing = readFileSync(trackerPath, 'utf-8')
      await writeFile(trackerPath, (existing.endsWith('\n') ? existing : existing + '\n') + row, 'utf-8')
    } else {
      await mkdir(dirname(trackerPath), { recursive: true })
      await writeFile(trackerPath, TRACKER_HEADER + row, 'utf-8')
    }

    return { reportPath, reportNumber: num }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return { reportPath: null, reportNumber: null, error: `Could not save the report: ${message}` }
  } finally {
    try {
      // Pass the original array back — reserve attaches an ownership token to
      // it that release requires to clear the reservation sentinel.
      await allocator.releaseReportNumbers(numbers, { reportsDir })
    } catch {
      // Best-effort — a stale sentinel is cleared by the tool's own gc.
    }
  }
}
