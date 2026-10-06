import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: {
    default: 'Passaporte do Aluno',
    template: '%s · Passaporte do Aluno',
  },
  description:
    'Plataforma escolar que reúne a jornada do aluno: escolas, turmas, professores, responsáveis e acompanhamento em um só lugar.',
  applicationName: 'Passaporte do Aluno',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1f3a6b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${geistMono.variable} bg-background`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  )
}
