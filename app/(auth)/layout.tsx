import { Brand } from '@/components/brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-sky/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute top-1/3 -right-24 size-80 rounded-full bg-sun/40 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/4 size-72 rounded-full bg-mint/40 blur-3xl" />
      <header className="relative px-5 pt-5">
        <Brand />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 py-8 md:items-center">
        <div className="w-full max-w-md animate-pop-in rounded-[2rem] border border-border bg-card/90 p-6 shadow-soft backdrop-blur md:p-8">
          <p className="mb-4 font-display text-sm font-semibold text-secondary-foreground">Olá! Que bom ver você por aqui 👋</p>
          {children}
        </div>
      </main>
    </div>
  )
}
