import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'JobMatch AI - Find Your Perfect Role',
  description: 'AI-powered job matching for new grads. Upload resumes, set preferences, and get matched with relevant jobs.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}