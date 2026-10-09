import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Nunito, Poppins } from 'next/font/google'
import './globals.css'

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' })
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-poppins',
})
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
  themeColor: '#3b8fd9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={[nunito.variable, poppins.variable, geistMono.variable, 'bg-background'].join(' ')}
    >
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  )
}
