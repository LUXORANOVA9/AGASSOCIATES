import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Adv. Aditya Gade | Advocate & AI Systems Architect',
  description: 'Building autonomous AI workflows for blitzscaling. Architected with the $7T Billion-Dollar Prompter Methodology.',
  keywords: ['Aditya Gade', 'Advocate', 'AI Systems', 'LangGraph', 'Zero-Staff Enterprise', 'AG Associates'],
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
