import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import QRCode from 'qrcode'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { academicYear, school, schoolClass, student } from '@/lib/db/schema'
import { Card, EmptyState, PageTitle } from '@/components/ui/card'
import { getCurrentEnrollments, getFamilyStudents } from '@/lib/attendance-queries'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Passaporte Educacional' }

export default async function FamilyPassportPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title="Passaporte Educacional" />
        <Card>
          <EmptyState
            title="Nenhum aluno vinculado"
            description="Peça à secretaria para vincular seus filhos usando o mesmo e-mail da sua conta."
          />
        </Card>
      </>
    )
  }

  const selected = students.find((s) => s.id === sp.student) ?? students[0]

  const [head] = await db
    .select({
      fullName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
      passportActive: student.passportActive,
      passportToken: student.passportToken,
      passportUpdatedAt: student.passportUpdatedAt,
      schoolName: school.name,
    })
    .from(student)
    .innerJoin(school, eq(school.id, schoolId))
    .where(and(eq(student.schoolId, schoolId), eq(student.id, selected.id), isNull(student.deletedAt)))
    .limit(1)

  const [enr] = await getCurrentEnrollments(schoolId, [selected.id])
  const classInfo = enr?.classId
    ? await db
        .select({ className: schoolClass.name, grade: schoolClass.grade, year: academicYear.year })
        .from(schoolClass)
        .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
        .where(and(eq(schoolClass.schoolId, schoolId), eq(schoolClass.id, enr.classId)))
        .limit(1)
    : []

  // O QR codifica a URL de validação com o token real; host derivado da requisição.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const qrPayload =
    head?.passportActive && head.passportToken ? `${proto}://${host}/school/passport/verify?token=${head.passportToken}` : null
  const qrSvg = qrPayload ? await QRCode.toString(qrPayload, { type: 'svg', margin: 1, width: 160 }) : null

  return (
    <>
      <PageTitle title="Passaporte Educacional" description="Carteirinha digital do aluno com QR Code de validação." />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/family/passport?student=${s.id}`}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      {head?.passportActive ? (
        <Card>
          <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-stretch">
            <div className="flex h-40 w-full flex-col justify-between rounded-xl bg-primary p-4 text-primary-foreground sm:w-64">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{head.schoolName}</p>
                <p className="mt-1 text-lg font-extrabold leading-tight">Passaporte Educacional</p>
              </div>
              <div>
                <p className="text-base font-bold">{head.socialName || head.fullName}</p>
                <p className="text-xs opacity-90">
                  Matrícula {head.registrationCode ?? '—'}
                  {classInfo[0] ? ` · ${classInfo[0].className} (${classInfo[0].year})` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              {qrSvg ? (
                <div
                  className="rounded-lg border border-border bg-white p-2 [&>svg]:h-40 [&>svg]:w-40"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : null}
              <p className="max-w-48 text-center text-[10px] text-muted-foreground">
                Apresente este QR na portaria. Válido enquanto a escola mantiver o passaporte ativo.
              </p>
            </div>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Perdeu o acesso? A secretaria pode emitir um novo QR (o anterior deixa de valer).
          </p>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Passaporte ainda não emitido"
            description="A secretaria emite o passaporte e o QR Code aparece aqui automaticamente."
          />
        </Card>
      )}
    </>
  )
}
