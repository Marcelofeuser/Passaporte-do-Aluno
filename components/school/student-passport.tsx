import Link from 'next/link'
import { ActionForm } from '@/components/school/action-form'
import { Card, EmptyState } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import type { ActionState } from '@/lib/validation'

export type PassportAction = (state: ActionState, formData: FormData) => Promise<ActionState>

const correctionSupportHref =
  'mailto:suporte@passaportedoaluno.com' +
  '?subject=' +
  encodeURIComponent('Solicitação de correção de histórico escolar') +
  '&body=' +
  encodeURIComponent(
    'Instituição que realizou o lançamento:\n' +
      'Identificação do aluno/passaporte:\n' +
      'Registro original e data:\n' +
      'Alteração solicitada:\n' +
      'Motivo e comprovação do erro:\n' +
      'Declaração assinada pelo diretor atual da instituição que realizou o lançamento e autenticada pelo GOV.br: anexada.\n',
  )

export type PassportRecord = {
  id: string
  dateLabel: string
  category: string
  title: string
  summary?: string | null
  href?: string | null
  hrefLabel?: string
}

export type PassportPeriod = {
  id: string
  schoolName: string
  startsOnLabel: string
  endsOnLabel?: string | null
  current: boolean
  records: PassportRecord[]
}

export type TransferSchoolOption = {
  id: string
  name: string
}

export function StudentPassportSection({
  periods,
  isCurrentSchool,
  transferPending,
  transferSchools,
  transferAction,
  cancelTransferAction,
  studentId,
}: {
  periods: PassportPeriod[]
  isCurrentSchool: boolean
  transferPending: { id: string; destination: string } | null
  transferSchools: TransferSchoolOption[]
  transferAction?: PassportAction
  cancelTransferAction?: PassportAction
  studentId: string
}) {
  return (
    <section className="flex flex-col gap-4">
      <Card
        title="Passaporte escolar"
        description="Histórico organizado por instituição. Cada escola mantém controle apenas sobre o período em que o aluno esteve sob sua responsabilidade."
      >
        <div className="flex flex-col gap-3 p-4">
          <p
            role="status"
            className={
              isCurrentSchool
                ? 'rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground'
                : 'rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground'
            }
          >
            {isCurrentSchool
              ? 'Sua escola é a instituição responsável pelo período atual.'
              : 'Este é um período anterior. Os registros da sua escola são somente para leitura.'}
          </p>
          {transferPending ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-3">
              <p role="status" className="text-sm text-muted-foreground">
                Transferência aguardando confirmação da escola {transferPending.destination}.
              </p>
              {isCurrentSchool && cancelTransferAction ? (
                <ActionForm
                  action={cancelTransferAction}
                  submitLabel="Cancelar solicitação"
                  pendingLabel="Cancelando…"
                  className="flex-row items-center"
                >
                  <input type="hidden" name="transferId" value={transferPending.id} />
                </ActionForm>
              ) : null}
            </div>
          ) : null}
          {isCurrentSchool && !transferPending && transferAction ? (
            transferSchools.length > 0 ? (
              <ActionForm
                action={transferAction}
                submitLabel="Solicitar transferência"
                pendingLabel="Enviando solicitação…"
                fieldLabels={{ destinationSchoolId: 'Escola de destino' }}
                className="border-t border-border pt-4"
              >
                <input type="hidden" name="studentId" value={studentId} />
                <Field label="Escola de destino" htmlFor="destinationSchoolId">
                  <Select id="destinationSchoolId" name="destinationSchoolId" required defaultValue="">
                    <option value="" disabled>
                      Selecione a escola
                    </option>
                    {transferSchools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </ActionForm>
            ) : (
              <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                Não há outra escola disponível para receber uma transferência.
              </p>
            )
          ) : null}
        </div>
      </Card>

      <Card
        title="Histórico por escola"
        description="Os documentos e registros permanecem vinculados à instituição que os criou."
      >
        {periods.length === 0 ? (
          <EmptyState
            title="Histórico ainda não disponível"
            description="Os períodos escolares aparecerão aqui quando o passaporte estiver vinculado."
          />
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {periods.map((period) => (
              <li key={period.id} className="flex flex-col gap-3 p-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold">{period.schoolName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {period.startsOnLabel} – {period.endsOnLabel ?? (period.current ? 'Atual' : 'Período encerrado')}
                    </p>
                  </div>
                  <span
                    className={
                      period.current
                        ? 'rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground'
                        : 'rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground'
                    }
                  >
                    {period.current ? 'Período atual' : 'Somente leitura'}
                  </span>
                </header>

                {period.records.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro neste período.</p>
                ) : (
                  <ol className="flex flex-col gap-3 border-l border-border pl-4">
                    {period.records.map((record) => (
                      <li key={record.id} className="flex flex-col gap-1">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {record.dateLabel} · {record.category}
                        </p>
                        <h4 className="font-semibold">{record.title}</h4>
                        {record.summary ? <p className="text-sm leading-relaxed text-muted-foreground">{record.summary}</p> : null}
                        {record.href ? (
                          <Link href={record.href} className="text-sm font-semibold text-primary hover:underline">
                            {record.hrefLabel ?? 'Abrir documento'}
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card
        title="Como solicitar correção de um registro antigo"
        description="O histórico escolar não pode ser editado pela escola anterior, pelo aluno, por professores ou pela direção."
      >
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            O responsável pelo aluno deve procurar a instituição que fez o lançamento e pedir que ela abra um chamado
            com o suporte. A solicitação deve indicar o registro original, a alteração desejada, o motivo e a
            comprovação do erro. É obrigatória uma declaração assinada pelo diretor atual dessa instituição e
            autenticada pelo GOV.br. O registro original permanece preservado; uma correção aprovada deve ser
            acrescentada ao histórico com trilha de auditoria.
          </p>
          <a
            href={correctionSupportHref}
            className="w-fit text-sm font-semibold text-primary hover:underline"
          >
            Preparar e-mail para o suporte
          </a>
          <p className="text-xs text-muted-foreground">
            Anexe a declaração autenticada e as provas antes de enviar. Este link apenas prepara o e-mail; ele não
            envia a solicitação nem valida documentos automaticamente.
          </p>
        </div>
      </Card>
    </section>
  )
}

export function IncomingTransfers({
  transfers,
  acceptAction,
  rejectAction,
}: {
  transfers: Array<{
    id: string
    studentName: string
    sourceSchoolName: string
    requestedAtLabel: string
  }>
  acceptAction: PassportAction
  rejectAction: PassportAction
}) {
  return (
    <Card title="Solicitações recebidas" description="A confirmação torna sua escola responsável pelo período atual do aluno.">
      {transfers.length === 0 ? (
        <EmptyState title="Nenhuma solicitação pendente" description="Novos pedidos de transferência aparecerão aqui." />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {transfers.map((transfer) => (
            <li key={transfer.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold">{transfer.studentName}</h3>
                <p className="text-sm text-muted-foreground">
                  Origem: {transfer.sourceSchoolName} · solicitação em {transfer.requestedAtLabel}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  A escola de origem manterá acesso somente de leitura aos registros do próprio período.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionForm action={acceptAction} submitLabel="Confirmar recebimento" pendingLabel="Confirmando…" className="flex-row items-center">
                  <input type="hidden" name="transferId" value={transfer.id} />
                </ActionForm>
                <ActionForm action={rejectAction} submitLabel="Recusar" pendingLabel="Recusando…" className="flex-row items-center">
                  <input type="hidden" name="transferId" value={transfer.id} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
