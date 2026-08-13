import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Prose - Find Your Perfect Role',
  description: 'AI-powered job matching. Upload resumes, set preferences, and get scored against live job openings.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: the script below writes a theme class onto <html>
    // before React hydrates, so server and client markup differ by design.
    <html lang="en" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/*
          Applies the stored theme before first paint. ThemeProvider only sets the
          class after mount, which left every load painting light first and
          snapping to dark — a white flash on each navigation for dark-mode users.
          Kept inline and dependency-free so it runs ahead of any bundle.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;c.remove('light','dark');c.add(d?'dark':'light');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}