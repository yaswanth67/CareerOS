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
      <body className="min-h-screen bg-belgium-50 text-khaki-900" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}