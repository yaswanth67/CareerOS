import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Last updated: August 2026</p>

        <div className="mt-8 space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using MatchIQ, you agree to these Terms of Service. If you do not
              agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">2. The Service</h2>
            <p>
              MatchIQ helps you find and compare job openings. It fetches public job listings from third-party
              boards, parses resumes you upload, and uses AI to estimate how well each job matches your profile.
              The service is provided &ldquo;as is&rdquo; and may be used for personal, non-commercial purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">3. Your Account</h2>
            <p>
              You are responsible for keeping your login name and password confidential and for all activity
              under your account. Notify us if you believe your account has been compromised. The login name
              is unique and shared names are not permitted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">4. Your Content</h2>
            <p>
              Resumes, preferences, and saved applications you upload or create remain yours. MatchIQ stores
              them locally and does not share them with other users. You are responsible for the accuracy of
              any personal information you provide.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">5. Third-Party Data</h2>
            <p>
              Job listings come from public APIs and career pages owned by their respective companies. MatchIQ
              does not control, endorse, or guarantee the accuracy of those listings. Always verify application
              details on the employer&apos;s own site before applying.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">6. No Professional Advice</h2>
            <p>
              Match scores and AI-generated reasoning are estimates intended to help you prioritize applications.
              They are not a guarantee of employment, compensation, or suitability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, MatchIQ and its developers are not liable for any direct,
              indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">8. Changes</h2>
            <p>
              We may update these Terms from time to time. Continued use of the service after changes are
              posted constitutes acceptance of the revised Terms.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
