import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Brand } from '@/components/brand'
import { buttonClasses } from '@/components/ui/button'
import { getSession } from '@/lib/session'

export default async function HomePage() {
  const session = await getSession()
  if (session?.user) redirect('/dashboard')

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-4">
        <Brand />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-8 px-4 py-10">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <span className="w-fit -rotate-3 rounded-md border-2 border-dashed border-accent px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-accent uppercase">
            Fase 1 · Fundação
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-balance">
            Toda a jornada escolar, carimbada em um só lugar.
          </h1>
          <p className="leading-relaxed text-muted-foreground text-pretty">
            Escolas, coordenação, professores, responsáveis e alunos com acesso certo para cada perfil.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <Link href="/sign-in" className={buttonClasses('primary')}>
              Entrar
            </Link>
            <Link href="/sign-up" className={buttonClasses('outline')}>
              Criar conta
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
