import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import { SessionProvider } from '@/lib/session'
import { I18nProvider } from '@/lib/i18n/react'
import './globals.css'

// The brief names both faces: Inter for interface, IBM Plex Mono for telemetry values.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AgriTech Sensing Solutions',
  description: 'Precision agriculture operations dashboard',
}

// Matches --bg-base in each theme so the browser chrome blends with the page.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8f6' },
    { media: '(prefers-color-scheme: dark)', color: '#141812' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Theme is read from localStorage before paint. Without this the server-rendered
          markup is always light and a dark-mode user gets a white flash on every load.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('agritech.theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${plexMono.variable} antialiased`}>
        {/* Keyboard users can jump the header and land on the page content. */}
        <a
          href="#main"
          className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <I18nProvider>
          <SessionProvider>{children}</SessionProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
