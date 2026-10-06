import type { Metadata } from 'next'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { requireSchoolPage } from '@/lib/school-page'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { getFinanceStatement, settledAmount } from '@/lib/finance-queries'
export const metadata: Metadata = { title: 'Financeiro da família' }
export default async function FamilyFinancePage() {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const students = await getFamilyStudents(schoolId, role === 'STUDENT' ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  const statement = await getFinanceStatement(schoolId, students.map((s) => s.id))
  return <><PageTitle title="Financeiro" description="Extratos, faturas em aberto e histórico de pagamentos dos alunos vinculados." />
    <Card><CardHeader title="Faturas" />{statement.invoices.length === 0 ? <EmptyState title="Nenhuma fatura" description="Não há cobranças financeiras disponíveis." /> : <ul className="divide-y divide-border">{statement.invoices.map((i) => { const paid = settledAmount(i.id, statement.settlements); const status = i.status === 'PAID' ? 'Pago' : i.status === 'CANCELLED' ? 'Cancelada' : i.dueOn < new Date().toISOString().slice(0, 10) ? 'Vencida' : 'Em aberto'; return <li key={i.id} className="flex justify-between gap-3 px-4 py-3 text-sm"><span><b>{i.studentName}</b> · {i.reference}<br /><span className="text-muted-foreground">Vencimento: {i.dueOn} · Pago: R$ {paid.toFixed(2)}</span></span><span className="text-right font-semibold">R$ {i.totalAmount.toFixed(2)}<br /><span className={status === 'Em aberto' || status === 'Vencida' ? 'text-destructive' : 'text-primary'}>{status}</span></span></li> })}</ul>}</Card>
    <Card><CardHeader title="Pagamentos registrados" />{statement.settlements.length === 0 ? <EmptyState title="Nenhum pagamento" description="Os pagamentos registrados pela escola aparecerão aqui." /> : <ul className="divide-y divide-border">{statement.settlements.map((s) => <li key={s.id} className="flex justify-between px-4 py-3 text-sm"><span>{s.paidOn} · {s.method}</span><strong>R$ {s.amount.toFixed(2)}</strong></li>)}</ul>}</Card>
  </>
}
