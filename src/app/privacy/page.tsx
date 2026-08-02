import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link href="/auth/signin" className="btn-secondary">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Last updated: August 2026</p>

        <div className="mt-8 space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">1. What We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your login name and a hashed (non-reversible) password.</li>
              <li>Resumes you upload and the parsed text extracted from them.</li>
              <li>Job search preferences and saved applications.</li>
              <li>Basic session data so you stay signed in.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">2. Where Your Data Lives</h2>
            <p>
              Your account, resumes, preferences, and applications are stored in a local database on the machine
              running MatchIQ. We do not sell or share this data with any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">3. AI Processing</h2>
            <p>
              To score jobs and parse resumes, selected text may be sent to the AI provider configured in
              <code className="mx-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm">.env</code>.
              By default MatchIQ points at your local Claude Code connection. If you configure a cloud AI API
              key instead, resume text may be transmitted to that provider to generate scores and analysis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">4. Sessions &amp; Cookies</h2>
            <p>
              MatchIQ uses a signed session token (NextAuth JWT) stored in your browser so you stay signed in.
              No advertising or tracking cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">5. Third-Party Services</h2>
            <p>
              Job listings are retrieved from public job-board APIs (for example Greenhouse and Lever) and
              company career pages. We only receive listing metadata; we do not send your resume to those
              services unless you use the &ldquo;Apply&rdquo; link to visit the employer&apos;s own application page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">6. Data Retention &amp; Deletion</h2>
            <p>
              You can delete resumes and saved applications at any time from the app. To remove your account
              entirely, contact the app operator. Deleting the local database removes all stored data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">7. Changes</h2>
            <p>
              We may update this policy from time to time. Changes take effect when posted on this page.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
