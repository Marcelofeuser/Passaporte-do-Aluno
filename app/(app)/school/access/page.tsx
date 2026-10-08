import type { Metadata } from 'next'
import { createAccessDevice, manualAccessLog, revokeAccessDevice, upsertCredential } from '@/app/actions/access'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { listStudents } from '@/lib/school-queries'
import { requireSchoolPage } from '@/lib/school-page'
import { can } from '@/lib/rbac'
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accessDevice, student, studentAccessLog } from '@/lib/db/schema'
import { calendarDateTime } from '@/lib/calendar'

export const metadata: Metadata = { title: 'Portaria' }

const TYPE_TONE: Record<string, string> = {
  ENTRADA: 'bg-primary/10 text-primary',
  SAIDA: 'bg-accent text-accent-foreground',
}

const METHOD_LABEL: Record<string, string> = { NFC: 'NFC', FACIAL: 'Biometria facial', MANUAL: 'Manual' }

export default async function SchoolAccessPage() {
  const { ctx, schoolId, role } = await requireSchoolPage('school:view_access')
  const canManage = can(role, 'school:manage_access')
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [logs, devices, studentsList] = await Promise.all([
    db
      .select({
        id: studentAccessLog.id,
        occurredAt: studentAccessLog.occurredAt,
        type: studentAccessLog.type,
        method: studentAccessLog.method,
        studentName: student.fullName,
        socialName: student.socialName,
        deviceName: accessDevice.name,
      })
      .from(studentAccessLog)
      .innerJoin(student, and(eq(student.id, studentAccessLog.studentId), eq(student.schoolId, schoolId)))
      .leftJoin(accessDevice, and(eq(accessDevice.id, studentAccessLog.deviceId), eq(accessDevice.schoolId, schoolId)))
      .where(and(eq(studentAccessLog.schoolId, schoolId), gte(studentAccessLog.occurredAt, todayStart)))
      .orderBy(desc(studentAccessLog.occurredAt))
      .limit(50),
    canManage
      ? db
          .select({
            id: accessDevice.id,
            name: accessDevice.name,
            location: accessDevice.location,
            isActive: accessDevice.isActive,
            lastSeenAt: accessDevice.lastSeenAt,
          })
          .from(accessDevice)
          .where(and(eq(accessDevice.schoolId, schoolId), isNull(accessDevice.deletedAt)))
          .orderBy(desc(accessDevice.createdAt))
      : [],
    canManage ? listStudents(schoolId) : [],
  ])

  // Presentes agora: alunos com última passagem do dia = ENTRADA.
  const presentRows = await db
    .select({
      studentId: studentAccessLog.studentId,
      name: student.fullName,
      socialName: student.socialName,
      lastType: sql<string>`(array_agg(${studentAccessLog.type} order by ${studentAccessLog.occurredAt} desc))[1]`,
    })
    .from(studentAccessLog)
    .innerJoin(student, and(eq(student.id, studentAccessLog.studentId), eq(student.schoolId, schoolId)))
    .where(and(eq(studentAccessLog.schoolId, schoolId), gte(studentAccessLog.occurredAt, todayStart)))
    .groupBy(studentAccessLog.studentId, student.fullName, student.socialName)
  const present = presentRows.filter((r) => r.lastType === 'ENTRADA')

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle
        title="Controle de portaria"
        description="Entradas e saídas via NFC e biometria facial, com registro manual quando necessário."
      />

      <Card title="Presentes agora" description="Alunos cuja última passagem de hoje é uma entrada.">
        {present.length === 0 ? (
          <EmptyState title="Nenhum aluno na escola" description="Assim que houver entradas registradas hoje, aparecem aqui." />
        ) : (
          <p className="px-4 pb-4 text-sm">{present.map((p) => p.socialName || p.name).join(' · ')}</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Últimos acessos de hoje" description="50 registros mais recentes." />
        {logs.length === 0 ? (
          <EmptyState title="Nenhum registro hoje" description="Os acessos registrados pelos dispositivos aparecem aqui." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TYPE_TONE[log.type] ?? ''}`}>{log.type}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{log.socialName || log.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {METHOD_LABEL[log.method] ?? log.method}
                      {log.deviceName ? ` · ${log.deviceName}` : ''}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">{calendarDateTime(log.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage ? (
        <>
          <Card title="Dispositivos de leitura" description="Catracas e leitores autenticam-se por chave; a chave é exibida uma única vez.">
            <ActionForm action={createAccessDevice} submitLabel="Criar dispositivo" className="p-4 sm:flex-row sm:items-end">
              <Field label="Nome" htmlFor="deviceName"><Input id="deviceName" name="name" required maxLength={120} placeholder="Portaria principal — catraca 1" /></Field>
              <Field label="Local (opcional)" htmlFor="deviceLocation"><Input id="deviceLocation" name="location" maxLength={160} /></Field>
            </ActionForm>
            {devices.length ? (
              <ul className="divide-y divide-border border-t border-border">
                {devices.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.location ?? 'Sem local'} · {d.isActive ? 'Ativo' : 'Inativo'} · visto em{' '}
                        {d.lastSeenAt ? calendarDateTime(d.lastSeenAt) : 'nunca'}
                      </p>
                    </div>
                    <ActionForm action={revokeAccessDevice} submitLabel="Revogar" className="p-0">
                      <input type="hidden" name="deviceId" value={d.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card title="Credenciais do aluno" description="Vincule o UID do cartão NFC e/ou o ID facial. Biometria exige consentimento do responsável (LGPD).">
            <ActionForm action={upsertCredential} submitLabel="Salvar credencial" className="p-4 grid gap-4 sm:grid-cols-2">
              <Field label="Aluno" htmlFor="credStudent">
                <Select id="credStudent" name="studentId" required defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  {studentsList.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </Select>
              </Field>
              <Field label="UID do cartão NFC" htmlFor="nfcCardUid"><Input id="nfcCardUid" name="nfcCardUid" maxLength={64} /></Field>
              <Field label="ID facial (motor externo)" htmlFor="facialProfileId"><Input id="facialProfileId" name="facialProfileId" maxLength={128} /></Field>
              <Field label="Consentimento LGPD" htmlFor="consent">
                <Select id="consent" name="consent" defaultValue="">
                  <option value="">Sem biometria facial</option>
                  <option value="yes">Responsável autorizou (registrar consentimento)</option>
                </Select>
              </Field>
            </ActionForm>
          </Card>

          <Card title="Registro manual" description="Para aluno sem credencial ou cartão esquecido.">
            <ActionForm action={manualAccessLog} submitLabel="Registrar acesso" className="p-4 sm:flex-row sm:items-end">
              <Field label="Aluno" htmlFor="manualStudent">
                <Select id="manualStudent" name="studentId" required defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  {studentsList.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo" htmlFor="manualType">
                <Select id="manualType" name="type" defaultValue="ENTRADA">
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saída</option>
                </Select>
              </Field>
            </ActionForm>
          </Card>
        </>
      ) : null}
    </>
  )
}
