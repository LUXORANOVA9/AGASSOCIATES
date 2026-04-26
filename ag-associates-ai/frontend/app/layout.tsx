import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Adv. Aditya Gade | Advocate & AI Systems Architect',
  description: 'Building autonomous AI workflows for blitzscaling. Architected with the $7T Billion-Dollar Prompter Methodology.',
  keywords: ['Aditya Gade', 'Advocate', 'AI Systems', 'LangGraph', 'Zero-Staff Enterprise', 'AG Associates'],
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
    <html lang="en" className="antialiased">
      <body>{children}</body>
    </html>
  )
}
