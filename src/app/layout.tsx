import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'CareerOS - Find Your Perfect Role',
  description: 'AI-powered job matching. Upload resumes, set preferences, and get scored against live job openings.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <head />
      {/*
        suppressHydrationWarning: browser extensions write their own attributes
        onto <body> before React hydrates — Grammarly adds
        `data-new-gr-c-s-check-loaded` and `data-gr-ext-installed`, which the
        server HTML cannot possibly contain. That mismatch is not a bug in this
        app and nothing here can prevent it, so the warning is suppressed for
        this element. It applies one level deep only: a genuine mismatch inside
        the tree still reports normally.
      */}
      <body className="min-h-screen bg-belgium-50 text-khaki-900" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}