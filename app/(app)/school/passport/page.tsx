import type { Metadata } from 'next'
import Link from 'next/link'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { academicYear, enrollment, schoolClass, student } from '@/lib/db/schema'
import { issuePassport, revokePassport } from '@/app/actions/passport'
import { ActionForm } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { requireSchoolPage } from '@/lib/school-page'
import { can } from '@/lib/rbac'

export const metadata: Metadata = { title: 'Passaporte Educacional' }

export default async function SchoolPassportPage() {
  const { schoolId, role } = await requireSchoolPage('school:view_access')
  const canManage = can(role, 'school:manage_access')

  const roster = await db
    .select({
      id: student.id,
      fullName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
      passportActive: student.passportActive,
      passportUpdatedAt: student.passportUpdatedAt,
      className: schoolClass.name,
      year: academicYear.year,
    })
    .from(student)
    .leftJoin(enrollment, and(eq(enrollment.studentId, student.id), eq(enrollment.status, 'ACTIVE')))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .leftJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .where(and(eq(student.schoolId, schoolId), isNull(student.deletedAt)))
    .orderBy(asc(student.fullName))

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle
        title="Passaporte Educacional"
        description="Carteirinha digital do aluno com QR Code de validação para portaria e eventos."
      />

      <Card>
        <CardHeader
          title="Passaportes por aluno"
          description="Emitir gera um novo token (o anterior deixa de valer). Revogar desativa imediatamente."
        />
        {roster.length === 0 ? (
          <EmptyState title="Nenhum aluno cadastrado" description="Cadastre alunos para emitir os passaportes." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {roster.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{s.socialName || s.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Matrícula {s.registrationCode ?? '—'}
                    {s.className ? ` · ${s.className} (${s.year ?? '—'})` : ' · Sem turma ativa'} ·{' '}
                    {s.passportActive ? (
                      <span className="font-semibold text-primary">Passaporte ativo</span>
                    ) : (
                      'Sem passaporte ativo'
                    )}
                    {s.passportUpdatedAt ? ` · atualizado em ${s.passportUpdatedAt.toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-2">
                    <ActionForm action={issuePassport} submitLabel="Emitir" className="p-0">
                      <input type="hidden" name="studentId" value={s.id} />
                    </ActionForm>
                    {s.passportActive ? (
                      <ActionForm action={revokePassport} submitLabel="Revogar" className="p-0">
                        <input type="hidden" name="studentId" value={s.id} />
                      </ActionForm>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Validar passaporte" description="Leia o QR Code da carteirinha ou digite o código apresentado.">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 text-sm">
          <p className="text-muted-foreground">A validação registra quem conferiu e quando (auditoria).</p>
          <Link
            href="/school/passport/verify"
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Abrir validador
          </Link>
        </div>
      </Card>
    </>
  )
}
