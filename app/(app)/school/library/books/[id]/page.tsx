import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { addCopies, archiveBook, updateBook, updateCopy } from '@/app/actions/library'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { todayISO } from '@/lib/attendance'
import { COPY_CONDITIONS, COPY_STATUS, MANUAL_COPY_STATUS, type CopyCondition, type CopyStatus } from '@/lib/library'
import { getBook, getLibraryRules, listCopies, listLoans } from '@/lib/library-queries'
import { UUID_RE } from '@/lib/school-action'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { cn } from '@/lib/utils'
import { BookFields, BOOK_FIELD_LABELS } from '../../book-fields'
import { LoanList } from '../../loan-list'

export const metadata: Metadata = { title: 'Título do acervo' }

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: 'bg-secondary text-secondary-foreground',
  LOANED: 'bg-accent text-accent-foreground',
  MAINTENANCE: 'bg-muted text-muted-foreground',
  LOST: 'bg-destructive/10 text-destructive',
  WITHDRAWN: 'bg-muted text-muted-foreground',
}

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { schoolId } = await requireSchoolPage('school:manage_library')
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const item = await getBook(schoolId, id)
  if (!item) notFound()
  const today = todayISO()
  const [copies, loans, rules] = await Promise.all([
    listCopies(schoolId, id),
    listLoans(schoolId, { bookId: id, today, limit: 50 }),
    getLibraryRules(schoolId),
  ])
  const inCollection = copies.filter((c) => c.status !== 'WITHDRAWN')
  const available = copies.filter((c) => c.status === 'AVAILABLE').length
  const loaned = copies.filter((c) => c.status === 'LOANED').length

  return (
    <>
      <BackLink href="/school/library/books">Acervo</BackLink>
      <PageTitle
        title={item.title}
        description={`${item.authors}${item.publisher ? ` · ${item.publisher}` : ''}${item.publishedYear ? ` · ${item.publishedYear}` : ''}`}
      />

      <Card>
        <CardHeader
          title="Exemplares"
          description={`${inCollection.length} no acervo · ${available} disponível(is) · ${loaned} emprestado(s)`}
        />
        {copies.length === 0 ? (
          <EmptyState title="Nenhum exemplar" description="Adicione exemplares para permitir empréstimos." />
        ) : (
          <ul className="divide-y divide-border">
            {copies.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono font-semibold">{c.code}</span>
                    <span className="text-sm text-muted-foreground">{COPY_CONDITIONS[c.condition as CopyCondition] ?? c.condition}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_TONE[c.status])}>
                      {COPY_STATUS[c.status as CopyStatus] ?? c.status}
                    </span>
                    {c.loanId ? (
                      <a href={`/school/library/loans/${c.loanId}`} className="text-sm text-primary hover:underline">
                        com {c.borrowerName} até {formatDate(c.dueOn)}
                      </a>
                    ) : null}
                  </summary>
                  <ActionForm
                    action={updateCopy}
                    submitLabel="Salvar exemplar"
                    resetOnSuccess={false}
                    className="mt-3"
                    fieldLabels={{ condition: 'Conservação', status: 'Situação', reason: 'Justificativa' }}
                  >
                    <input type="hidden" name="copyId" value={c.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Estado de conservação" htmlFor={`cond-${c.id}`}>
                        <Select id={`cond-${c.id}`} name="condition" defaultValue={c.condition}>
                          {Object.entries(COPY_CONDITIONS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="Situação"
                        htmlFor={`status-${c.id}`}
                        hint={c.status === 'LOANED' ? 'Emprestado: altere pela devolução ou extravio do empréstimo.' : undefined}
                      >
                        <Select id={`status-${c.id}`} name="status" defaultValue={c.status} disabled={c.status === 'LOANED'}>
                          {(c.status === 'LOANED' ? ['LOANED'] : MANUAL_COPY_STATUS).map((k) => (
                            <option key={k} value={k}>
                              {COPY_STATUS[k as CopyStatus]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <Field label="Observações" htmlFor={`notes-${c.id}`}>
                      <Input id={`notes-${c.id}`} name="notes" maxLength={300} defaultValue={c.notes ?? ''} />
                    </Field>
                    <Field label="Justificativa (obrigatória ao mudar a situação)" htmlFor={`reason-${c.id}`}>
                      <Input id={`reason-${c.id}`} name="reason" maxLength={500} />
                    </Field>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border p-4">
          <ActionForm
            action={addCopies}
            submitLabel="Adicionar exemplares"
            fieldLabels={{ quantity: 'Quantidade', code: 'Código', condition: 'Conservação' }}
          >
            <input type="hidden" name="bookId" value={item.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Quantidade" htmlFor="add-quantity">
                <Input id="add-quantity" name="quantity" type="number" min={1} max={100} required defaultValue={1} />
              </Field>
              <Field label="Código (opcional)" htmlFor="add-code" hint="Em branco = próximo tombo sequencial.">
                <Input id="add-code" name="code" maxLength={30} />
              </Field>
              <Field label="Estado de conservação" htmlFor="add-condition">
                <Select id="add-condition" name="condition" defaultValue="NEW">
                  {Object.entries(COPY_CONDITIONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </ActionForm>
        </div>
      </Card>

      <Card>
        <CardHeader title="Histórico de empréstimos" description="Últimos 50 empréstimos deste título." />
        {loans.length === 0 ? (
          <EmptyState title="Sem empréstimos" description="Este título ainda não foi emprestado." />
        ) : (
          <LoanList loans={loans} today={today} alertDays={rules.dueAlertDays} showBorrower />
        )}
      </Card>

      <Card>
        <CardHeader title="Dados do título" />
        <ActionForm action={updateBook} submitLabel="Salvar dados" resetOnSuccess={false} className="p-4" fieldLabels={BOOK_FIELD_LABELS}>
          <input type="hidden" name="bookId" value={item.id} />
          <BookFields prefix="edit" values={item} />
        </ActionForm>
      </Card>

      <Card>
        <CardHeader
          title="Baixar título do acervo"
          description="Retira o título e todos os exemplares do acervo. O histórico de empréstimos é mantido."
        />
        <ActionForm action={archiveBook} submitLabel="Baixar do acervo" className="p-4" fieldLabels={{ reason: 'Motivo' }}>
          <input type="hidden" name="bookId" value={item.id} />
          <Field label="Motivo da baixa" htmlFor="archive-reason">
            <Textarea id="archive-reason" name="reason" required minLength={5} maxLength={500} className="min-h-16" />
          </Field>
        </ActionForm>
      </Card>
    </>
  )
}
