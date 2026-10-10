import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardHeader, RoleStamp } from '@/components/ui/card'
import { OnboardingChecklist } from '@/components/school/onboarding-checklist'
import { getOnboardingSteps } from '@/lib/onboarding'
import { getSchoolCounts, listSchools } from '@/lib/queries'
import { can, ROLE_LABELS, type Role } from '@/lib/rbac'
import { isSuperAdmin, requirePageContext } from '@/lib/session'

export const metadata: Metadata = { title: 'Início' }

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-4">
      <span className="font-mono text-2xl font-bold">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center justify-between gap-3 p-4 font-semibold hover:bg-muted">
      {label}
      <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

export default async function DashboardPage() {
  const ctx = await requirePageContext()
  const firstName = ctx.user.name.split(' ')[0]
  const role = ctx.active?.role

  return (
    <>
      <div className="flex flex-col gap-3">
        {role ? <RoleStamp>{ROLE_LABELS[role]}</RoleStamp> : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-balance">Olá, {firstName}</h1>
        {ctx.active?.schoolName ? (
          <p className="leading-relaxed text-muted-foreground">{ctx.active.schoolName}</p>
        ) : null}
      </div>

      {!ctx.active ? (
        <PendingAccess />
      ) : isSuperAdmin(ctx) && role === 'SUPER_ADMIN' ? (
        <SuperAdminHome />
      ) : ctx.active.schoolId ? (
        <SchoolHome
          schoolId={ctx.active.schoolId}
          role={ctx.active.role}
          userId={ctx.user.id}
          email={ctx.user.email}
        />
      ) : null}
    </>
  )
}

async function SchoolHome({
  schoolId,
  role,
  userId,
  email,
}: {
  schoolId: string
  role: Role
  userId: string
  email: string
}) {
  {
    const showStats = can(role, 'school:view_users')
    const [counts, steps] = await Promise.all([
      showStats ? getSchoolCounts(schoolId) : null,
      getOnboardingSteps(schoolId, role, userId, email),
    ])
    return (
      <>
        {steps ? (
          <OnboardingChecklist
            steps={steps}
            description={
              role === 'TEACHER'
                ? 'Siga esta ordem para começar a usar o diário.'
                : 'Siga esta ordem para deixar a escola pronta para chamada e notas.'
            }
          />
        ) : null}
        {counts ? (
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Usuários" value={counts.members} />
            <Stat label="Professores" value={counts.teachers} />
            <Stat label="Alunos" value={counts.students} />
          </div>
        ) : null}
        <Card>
          <CardHeader title="Atalhos" />
          <div className="divide-y divide-border">
            {showStats ? <QuickLink href="/school/users" label="Usuários da escola" /> : null}
            {can(role, 'school:view_audit') ? <QuickLink href="/audit" label="Auditoria" /> : null}
            <QuickLink href="/notifications" label="Avisos" />
            <QuickLink href="/profile" label="Meu perfil" />
          </div>
        </Card>
      </>
    )
  }
}

async function SuperAdminHome() {
  const schools = await listSchools()
  const members = schools.reduce((acc, s) => acc + s.members, 0)
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Escolas ativas" value={schools.length} />
        <Stat label="Vínculos" value={members} />
      </div>
      <Card>
        <CardHeader title="Atalhos" />
        <div className="divide-y divide-border">
          <QuickLink href="/admin/schools" label="Gerenciar escolas" />
          <QuickLink href="/audit" label="Auditoria da plataforma" />
        </div>
      </Card>
    </>
  )
}

function PendingAccess() {
  return (
    <Card>
      <CardHeader title="Acesso pendente" />
      <p className="p-4 leading-relaxed text-muted-foreground text-pretty">
        Sua conta foi criada, mas ainda não está vinculada a uma escola. Peça à direção ou secretaria para liberar seu
        acesso com o e-mail que você usou no cadastro.
      </p>
    </Card>
  )
}
