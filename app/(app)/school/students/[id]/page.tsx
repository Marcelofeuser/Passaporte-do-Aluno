import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  addParent,
  archiveStudent,
  deleteStudentDocument,
  endEnrollment,
  enrollStudent,
  unlinkParent,
  updateStudent,
  uploadStudentDocument,
} from '@/app/actions/students'
import { ActionForm, ConfirmSubmit } from '@/components/school/action-form'
import { AddressFields, BackLink, FileField, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { UUID_RE } from '@/lib/school-action'
import { formatBytes, formatDate, requireSchoolPage } from '@/lib/school-page'
import {
  getCurrentYear,
  getStudent,
  getStudentDocuments,
  getStudentEnrollments,
  getStudentParents,
  listClasses,
} from '@/lib/school-queries'
import { fileUrl } from '@/lib/storage'
import { DOCUMENT_KINDS, RELATIONSHIPS, SEX_OPTIONS, SHIFTS } from '@/lib/validation'

export const metadata: Metadata = { title: 'Ficha do aluno' }

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Ativa', INACTIVE: 'Encerrada', TRANSFERRED: 'Transferida' }

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const { schoolId, canManage } = await requireSchoolPage('school:view_students')

  const s = await getStudent(schoolId, id)
  if (!s) notFound()
  const currentYear = await getCurrentYear(schoolId)
  const [parents, enrollments, documents, classes] = await Promise.all([
    getStudentParents(schoolId, id),
    getStudentEnrollments(schoolId, id),
    getStudentDocuments(schoolId, id),
    currentYear ? listClasses(schoolId, currentYear.id) : Promise.resolve([]),
  ])
  const active = enrollments.find((e) => e.status === 'ACTIVE')
  const displayName = s.socialName ?? s.fullName

  return (
    <>
      <BackLink href="/school/students">Alunos</BackLink>

      <header className="flex items-center gap-4">
        {s.photoPathname ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(s.photoPathname)} alt={`Foto de ${displayName}`} className="size-20 rounded-xl border border-border object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-xl bg-secondary text-3xl font-extrabold text-secondary-foreground">
            {displayName.charAt(0)}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <PageTitle title={displayName} />
          <p className="text-sm text-muted-foreground">
            {s.socialName ? `Nome civil: ${s.fullName} · ` : ''}
            {s.registrationCode ? `Matrícula ${s.registrationCode}` : 'Sem número de matrícula'}
            {active ? ` · ${active.className ?? active.grade} (${active.year})` : ' · Sem turma'}
          </p>
        </div>
      </header>

      {/* Matrícula */}
      <Card>
        <CardHeader
          title="Matrícula e turma"
          description={currentYear ? `Ano letivo vigente: ${currentYear.year}` : 'Defina um ano letivo vigente para matricular.'}
        />
        {enrollments.length === 0 ? (
          <EmptyState title="Sem matrículas" description="Este aluno ainda não foi matriculado em uma turma." />
        ) : (
          <ul className="divide-y divide-border">
            {enrollments.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-1 flex-col">
                  <span className="font-semibold">
                    {e.year} · {e.className ?? e.grade}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {STATUS_LABEL[e.status] ?? e.status} · desde {formatDate(e.enrolledOn)}
                  </span>
                </div>
                {e.classId ? (
                  <Link href={`/school/classes/${e.classId}`} className="text-sm font-semibold text-primary hover:underline">
                    Ver turma
                  </Link>
                ) : null}
                {canManage && e.status === 'ACTIVE' ? (
                  <form action={endEnrollment}>
                    <input type="hidden" name="enrollmentId" value={e.id} />
                    <input type="hidden" name="returnTo" value={`/school/students/${id}`} />
                    <ConfirmSubmit confirm="Encerrar esta matrícula?">Encerrar</ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage && currentYear ? (
          classes.length === 0 ? (
            <p className="border-t border-border p-4 text-sm text-muted-foreground">
              Nenhuma turma no ano vigente.{' '}
              <Link href="/school/classes" className="font-semibold text-primary hover:underline">
                Criar turma
              </Link>
            </p>
          ) : (
            <ActionForm action={enrollStudent} submitLabel={active ? 'Transferir de turma' : 'Matricular'} className="border-t border-border p-4">
              <input type="hidden" name="studentId" value={id} />
              <Field label={active ? 'Nova turma' : 'Turma'} htmlFor="classId">
                <Select id="classId" name="classId" required defaultValue="">
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.id === active?.classId}>
                      {c.name} · {c.grade} · {SHIFTS[c.shift as keyof typeof SHIFTS] ?? c.shift}
                      {c.capacity ? ` (${c.enrolled}/${c.capacity})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </ActionForm>
          )
        ) : null}
      </Card>

      {/* Responsáveis */}
      <Card>
        <CardHeader title="Responsáveis" description="Quem pode acompanhar a vida escolar do aluno." />
        {parents.length === 0 ? (
          <EmptyState title="Nenhum responsável" description="Vincule ao menos um responsável." />
        ) : (
          <ul className="divide-y divide-border">
            {parents.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{p.fullName}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {RELATIONSHIPS[p.relationship as keyof typeof RELATIONSHIPS] ?? p.relationship}
                    {p.phone ? ` · ${p.phone}` : ''}
                    {p.email ? ` · ${p.email}` : ''}
                  </span>
                </div>
                {canManage ? (
                  <form action={unlinkParent}>
                    <input type="hidden" name="studentId" value={id} />
                    <input type="hidden" name="parentId" value={p.id} />
                    <ConfirmSubmit confirm={`Desvincular ${p.fullName}?`}>Desvincular</ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <ActionForm
            action={addParent}
            submitLabel="Vincular responsável"
            className="border-t border-border p-4"
            fieldLabels={{ fullName: 'Nome', relationship: 'Parentesco', email: 'E-mail', cpf: 'CPF' }}
          >
            <input type="hidden" name="studentId" value={id} />
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Field label="Nome do responsável" htmlFor="p-fullName">
                <Input id="p-fullName" name="fullName" required maxLength={160} />
              </Field>
              <Field label="Parentesco" htmlFor="p-relationship">
                <Select id="p-relationship" name="relationship" required defaultValue="MOTHER">
                  {Object.entries(RELATIONSHIPS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Telefone" htmlFor="p-phone">
                <Input id="p-phone" name="phone" type="tel" maxLength={20} />
              </Field>
              <Field label="E-mail" htmlFor="p-email">
                <Input id="p-email" name="email" type="email" maxLength={160} />
              </Field>
              <Field label="CPF" htmlFor="p-cpf" hint="Reaproveita o cadastro de irmãos.">
                <Input id="p-cpf" name="cpf" inputMode="numeric" maxLength={14} />
              </Field>
            </div>
          </ActionForm>
        ) : null}
      </Card>

      {/* Documentos */}
      <Card>
        <CardHeader title="Documentos" description="Arquivos privados, visíveis apenas para a secretaria e coordenação." />
        {documents.length === 0 ? (
          <EmptyState title="Nenhum documento" description="Envie certidão, RG, vacinação e outros." />
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <a href={fileUrl(d.pathname)} target="_blank" rel="noreferrer" className="truncate font-semibold text-primary hover:underline">
                    {d.label}
                  </a>
                  <span className="text-sm text-muted-foreground">
                    {DOCUMENT_KINDS[d.kind as keyof typeof DOCUMENT_KINDS] ?? d.kind} · {d.contentType === 'application/pdf' ? 'PDF' : 'Imagem'} ·{' '}
                    {formatBytes(d.sizeBytes)} · {formatDate(d.createdAt)}
                  </span>
                </div>
                {canManage ? (
                  <form action={deleteStudentDocument}>
                    <input type="hidden" name="documentId" value={d.id} />
                    <ConfirmSubmit confirm="Excluir este documento?">Excluir</ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <ActionForm action={uploadStudentDocument} submitLabel="Enviar documento" pendingLabel="Enviando…" className="border-t border-border p-4" fieldLabels={{ file: 'Arquivo', kind: 'Tipo' }}>
            <input type="hidden" name="studentId" value={id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo" htmlFor="d-kind">
                <Select id="d-kind" name="kind" defaultValue="BIRTH_CERTIFICATE">
                  {Object.entries(DOCUMENT_KINDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Descrição (opcional)" htmlFor="d-label">
                <Input id="d-label" name="label" maxLength={120} />
              </Field>
            </div>
            <FileField id="d-file" name="file" label="Arquivo" accept="application/pdf,image/png,image/jpeg,image/webp" hint="PDF ou imagem até 10 MB." required />
          </ActionForm>
        ) : null}
      </Card>

      {/* Dados pessoais */}
      <Card>
        <CardHeader title="Dados do aluno" />
        {canManage ? (
          <ActionForm
            action={updateStudent}
            submitLabel="Salvar dados"
            resetOnSuccess={false}
            className="p-4"
            fieldLabels={{ fullName: 'Nome', registrationCode: 'Matrícula', cpf: 'CPF', email: 'E-mail', birthDate: 'Nascimento', addressZip: 'CEP', addressState: 'UF', photo: 'Foto' }}
          >
            <input type="hidden" name="studentId" value={id} />
            <FileField id="photo" name="photo" label="Foto" accept="image/png,image/jpeg,image/webp" hint="PNG, JPG ou WebP até 3 MB." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo (civil)" htmlFor="fullName">
                <Input id="fullName" name="fullName" required maxLength={160} defaultValue={s.fullName} />
              </Field>
              <Field label="Nome social" htmlFor="socialName">
                <Input id="socialName" name="socialName" maxLength={160} defaultValue={s.socialName ?? ''} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Matrícula" htmlFor="registrationCode">
                <Input id="registrationCode" name="registrationCode" maxLength={30} defaultValue={s.registrationCode ?? ''} />
              </Field>
              <Field label="Nascimento" htmlFor="birthDate">
                <Input id="birthDate" name="birthDate" type="date" defaultValue={s.birthDate ?? ''} />
              </Field>
              <Field label="Sexo" htmlFor="sex">
                <Select id="sex" name="sex" defaultValue={s.sex ?? ''}>
                  <option value="">Não informado</option>
                  {Object.entries(SEX_OPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="CPF" htmlFor="cpf">
                <Input id="cpf" name="cpf" inputMode="numeric" maxLength={14} defaultValue={s.cpf ?? ''} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail" htmlFor="email">
                <Input id="email" name="email" type="email" maxLength={160} defaultValue={s.email ?? ''} />
              </Field>
              <Field label="Telefone" htmlFor="phone">
                <Input id="phone" name="phone" type="tel" maxLength={20} defaultValue={s.phone ?? ''} />
              </Field>
            </div>
            <AddressFields prefix="student" values={s} />
            <Field label="Observações (saúde, alergias, autorizações)" htmlFor="notes">
              <Textarea id="notes" name="notes" maxLength={2000} defaultValue={s.notes ?? ''} />
            </Field>
          </ActionForm>
        ) : (
          <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Nascimento</dt>
              <dd className="font-semibold">{formatDate(s.birthDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Telefone</dt>
              <dd className="font-semibold">{s.phone ?? '—'}</dd>
            </div>
          </dl>
        )}
      </Card>

      {canManage ? (
        <form action={archiveStudent} className="flex justify-end">
          <input type="hidden" name="studentId" value={id} />
          <ConfirmSubmit confirm="Arquivar este aluno? As matrículas ativas serão encerradas.">Arquivar aluno</ConfirmSubmit>
        </form>
      ) : null}
    </>
  )
}
