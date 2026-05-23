import type { Metadata } from 'next'
import { DM_Serif_Display, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const display = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-display',
})

const sans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Adv. Aditya Gade | Advocate & AI Systems Architect',
  description: 'Building autonomous AI workflows for blitzscaling. Architected with the $7T Billion-Dollar Prompter Methodology.',
  keywords: ['Aditya Gade', 'Advocate', 'AI Systems', 'LangGraph', 'Zero-Staff Enterprise', 'AG Associates'],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AG Field',
 },
  openGraph: {
    title: 'Adv. Aditya Gade | Advocate & AI Systems Architect',
    description: 'Building autonomous AI workflows for blitzscaling. Zero staff. Exponential scale.',
    url: 'https://advadityagade.com',
    siteName: 'Adv. Aditya Gade',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Adv. Aditya Gade | Advocate & AI Systems Architect',
    description: 'Building autonomous AI workflows for blitzscaling. Zero staff. Exponential scale.',
  },
  metadataBase: new URL('https://advadityagade.com'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`antialiased ${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
