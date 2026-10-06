import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Passaporte do Aluno',
    short_name: 'Passaporte',
    description: 'Plataforma escolar que reúne a jornada do aluno em um só lugar.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f7f8fb',
    theme_color: '#1f3a6b',
    lang: 'pt-BR',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
