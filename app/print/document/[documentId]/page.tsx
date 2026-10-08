import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { academicYear, schoolClass } from '@/lib/db/schema'
import { getAttendanceTotals, getCurrentEnrollments, getFamilyStudents } from '@/lib/attendance-queries'
import { attendanceRate, formatRate } from '@/lib/attendance'
import { getReportCard } from '@/lib/report-card'
import { DOCUMENT_TYPE_LABELS, getIssuedDocument } from '@/lib/documents'
import { requirePageContext } from '@/lib/session'
import { formatScore, GRADE_STATUS_LABEL } from '@/lib/grades'

export const metadata: Metadata = { title: 'Documento para impressão' }

/**
 * Rota de impressão do documento emitido (Declaração/Comprovante/Histórico parcial).
 * Acesso: família vinculada ao aluno ou equipe da escola. Conteúdo = dados vivos do dia
 * da impressão (turma atual, frequência, notas) + código de autenticidade da emissão.
 */
export default async function DocumentPrintPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params
  const ctx = await requirePageContext()
  const schoolId = ctx.active?.schoolId
  const role = ctx.active?.role
  if (!schoolId || !role) notFound()

  const doc = await getIssuedDocument(schoolId, documentId)
  if (!doc || doc.revokedAt) notFound()

  const isFamily = role === 'PARENT' || role === 'STUDENT'
  if (isFamily) {
    const students = await getFamilyStudents(schoolId, role, ctx.user.id, ctx.user.email)
    if (!students.some((s) => s.id === doc.studentId)) notFound()
  }

  const [enr] = await getCurrentEnrollments(schoolId, [doc.studentId])
  const classInfo = enr?.classId
    ? (
        await db
          .select({ className: schoolClass.name, grade: schoolClass.grade, year: academicYear.year })
          .from(schoolClass)
          .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
          .where(and(eq(schoolClass.schoolId, schoolId), eq(schoolClass.id, enr.classId)))
          .limit(1)
      )[0]
    : null

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const verifyUrl = `${proto}://${host}/verify/document?code=${doc.verificationCode}`
  const qrSvg = await QRCode.toString(verifyUrl, { type: 'svg', margin: 1, width: 110 })

  const name = doc.socialName || doc.studentName
  const issued = doc.createdAt.toLocaleDateString('pt-BR')

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-black print:p-0">
      <header className="border-b border-black/30 pb-6 text-center">
        <h1 className="text-lg font-bold uppercase">{doc.schoolName}</h1>
        <p className="mt-6 text-2xl font-extrabold uppercase tracking-wide">
          {DOCUMENT_TYPE_LABELS[doc.docType] ?? doc.docType}
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm leading-relaxed">
        {doc.docType === 'ENROLLMENT_DECLARATION' ? (
          <p>
            Declaramos para os devidos fins que <strong>{name}</strong>
            {doc.registrationCode ? `, portador(a) da matrícula ${doc.registrationCode}` : ''} está regularmente
            matriculado(a) nesta instituição
            {classInfo ? ` no ${classInfo.grade} — turma ${classInfo.className}, ano letivo ${classInfo.year}` : ''}.
          </p>
        ) : null}

        {doc.docType === 'ATTENDANCE_PROOF' ? (
          <AttendanceProof schoolId={schoolId} studentId={doc.studentId} classId={enr?.classId ?? null} name={name} classInfo={classInfo ?? null} />
        ) : null}

        {doc.docType === 'PARTIAL_TRANSCRIPT' ? (
          <PartialTranscript schoolId={schoolId} studentId={doc.studentId} classId={enr?.classId ?? null} name={name} classInfo={classInfo ?? null} />
        ) : null}

        <p>
          Emitido digitalmente em {issued} pela plataforma Passaporte do Aluno, mediante solicitação registrada no
          sistema.
        </p>
      </section>

      <footer className="mt-14 flex items-end justify-between border-t border-black/20 pt-6">
        <div className="text-[10px] text-black/70">
          <p className="font-bold uppercase">Autenticidade</p>
          <p>
            Código: <span className="font-mono">{doc.verificationCode}</span>
          </p>
          <p>Valide em {proto}://{host}/verify/document</p>
        </div>
        <div className="text-center">
          <div className="[&>svg]:h-28 [&>svg]:w-28" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="mt-1 text-[9px] text-black/60">Aponte a câmera para validar</p>
        </div>
      </footer>
    </div>
  )
}

async function AttendanceProof({
  schoolId,
  studentId,
  classId,
  name,
  classInfo,
}: {
  schoolId: string
  studentId: string
  classId: string | null
  name: string
  classInfo: { className: string; grade: string; year: number } | null
}) {
  const totals = classId ? await getAttendanceTotals(schoolId, { classId, studentIds: [studentId] }) : []
  const all = totals.reduce(
    (acc, r) => ({
      given: acc.given + r.given,
      absent: acc.absent + r.absent,
      late: acc.late + r.late,
      earlyLeave: acc.earlyLeave + r.earlyLeave,
    }),
    { given: 0, absent: 0, late: 0, earlyLeave: 0 },
  )
  return (
    <>
      <p>
        Declaramos para os devidos fins que <strong>{name}</strong>
        {classInfo ? `, aluno(a) do ${classInfo.grade} — turma ${classInfo.className}, ano letivo ${classInfo.year}` : ''}, possui o
        seguinte registro de frequência nesta instituição:
      </p>
      <ul className="ml-6 list-disc">
        <li>Aulas registradas: <strong>{all.given}</strong></li>
        <li>Faltas: <strong>{all.absent}</strong></li>
        <li>Atrasos: <strong>{all.late}</strong></li>
        <li>Frequência: <strong>{formatRate(attendanceRate(all))}</strong></li>
      </ul>
    </>
  )
}

async function PartialTranscript({
  schoolId,
  studentId,
  classId,
  name,
  classInfo,
}: {
  schoolId: string
  studentId: string
  classId: string | null
  name: string
  classInfo: { className: string; grade: string; year: number } | null
}) {
  const card = classId ? await getReportCard(schoolId, studentId, classId) : null
  return (
    <>
      <p>
        Declaramos para os devidos fins as notas parciais de <strong>{name}</strong>
        {classInfo ? `, aluno(a) do ${classInfo.grade} — turma ${classInfo.className}, ano letivo ${classInfo.year}` : ''}:
      </p>
      {card && card.rows.length > 0 ? (
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-black/30 text-left">
              <th className="py-1.5 pr-2 font-bold">Disciplina</th>
              <th className="px-2 py-1.5 text-right font-bold">Média</th>
              <th className="px-2 py-1.5 text-right font-bold">Recup.</th>
              <th className="px-2 py-1.5 text-right font-bold">Final</th>
              <th className="px-2 py-1.5 text-right font-bold">Faltas</th>
              <th className="px-2 py-1.5 text-right font-bold">Situação</th>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((row) => (
              <tr key={row.subjectId} className="border-b border-black/10">
                <td className="py-1.5 pr-2">{row.subjectName}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatScore(row.result.average)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatScore(row.result.recovery)}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatScore(row.result.final)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.attendance.absent}</td>
                <td className="px-2 py-1.5 text-right">{GRADE_STATUS_LABEL[row.result.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs">Ainda não há notas lançadas para este aluno.</p>
      )}
    </>
  )
}
