import type { Metadata } from 'next'
import { ActionForm } from '@/components/school/action-form'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { createChargeType, createFinanceCategory, createInvoice, createPaymentPlan, settleInvoice } from '@/app/actions/finance'
import { requireSchoolPage } from '@/lib/school-page'
import { db } from '@/lib/db'
import { financeCategory, financeChargeType, paymentPlan } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { listFinanceInvoices } from '@/lib/finance-queries'
export const metadata: Metadata = { title: 'Gestão financeira' }
export default async function FinancePage() {
  const { schoolId } = await requireSchoolPage('school:manage_finance')
  const [categories, types, plans, invoices] = await Promise.all([
    db.select().from(financeCategory).where(and(eq(financeCategory.schoolId, schoolId), isNull(financeCategory.deletedAt))),
    db.select().from(financeChargeType).where(and(eq(financeChargeType.schoolId, schoolId), isNull(financeChargeType.deletedAt))),
    db.select().from(paymentPlan).where(and(eq(paymentPlan.schoolId, schoolId), isNull(paymentPlan.deletedAt))),
    listFinanceInvoices(schoolId),
  ])
  return <><PageTitle title="Gestão financeira" description="Configure cobranças, planos e acompanhe recebimentos com isolamento por escola." />
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader title="Categorias" /><ActionForm action={createFinanceCategory} submitLabel="Cadastrar" className="p-4"><Field label="Nome" htmlFor="name"><Input name="name" id="name" required /></Field><Field label="Descrição" htmlFor="description"><Input name="description" id="description" /></Field></ActionForm><ul className="px-4 pb-4 text-sm">{categories.map((c) => <li key={c.id}>{c.name}</li>)}</ul></Card>
      <Card><CardHeader title="Tipos de cobrança" /><ActionForm action={createChargeType} submitLabel="Cadastrar" className="p-4"><Field label="Nome" htmlFor="name"><Input name="name" id="name" required /></Field><Field label="Valor padrão" htmlFor="defaultAmount"><Input name="defaultAmount" id="defaultAmount" type="number" step="0.01" min="0" required /></Field></ActionForm><ul className="px-4 pb-4 text-sm">{types.map((t) => <li key={t.id}>{t.name} · R$ {t.defaultAmount.toFixed(2)}</li>)}</ul></Card>
      <Card><CardHeader title="Planos de pagamento" /><ActionForm action={createPaymentPlan} submitLabel="Cadastrar" className="p-4"><Field label="Nome" htmlFor="name"><Input name="name" id="name" required /></Field><Field label="Parcelas" htmlFor="installments"><Input name="installments" id="installments" type="number" min="1" defaultValue="1" /></Field><Field label="Dia de vencimento" htmlFor="dueDay"><Input name="dueDay" id="dueDay" type="number" min="1" max="28" defaultValue="10" /></Field></ActionForm><ul className="px-4 pb-4 text-sm">{plans.map((p) => <li key={p.id}>{p.name} · {p.installments}x</li>)}</ul></Card>
    </div>
    <Card><CardHeader title="Criar fatura manual" /><ActionForm action={createInvoice} submitLabel="Criar fatura" className="grid gap-3 p-4 sm:grid-cols-2"><Field label="Aluno (ID)" htmlFor="studentId"><Input name="studentId" id="studentId" required /></Field><Field label="Referência" htmlFor="reference"><Input name="reference" id="reference" required /></Field><Field label="Vencimento" htmlFor="dueOn"><Input name="dueOn" id="dueOn" type="date" required /></Field><Field label="Valor" htmlFor="amount"><Input name="amount" id="amount" type="number" step="0.01" required /></Field><Field label="Descrição" htmlFor="description"><Input name="description" id="description" required /></Field></ActionForm></Card>
    <Card><CardHeader title="Faturas" description={`${invoices.length} fatura(s)`} /><ul className="divide-y divide-border">{invoices.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"><span className="flex-1"><b>{i.studentName}</b> · {i.reference} · vence {i.dueOn}</span><span>R$ {i.totalAmount.toFixed(2)} · {i.status}</span>{i.status === 'OPEN' ? <ActionForm action={settleInvoice} submitLabel="Baixar" className="flex items-center gap-2" resetOnSuccess><input type="hidden" name="invoiceId" value={i.id} /><Input name="amount" aria-label="Valor pago" type="number" step="0.01" defaultValue={i.totalAmount} /><Input name="paidOn" aria-label="Data do pagamento" type="date" required /></ActionForm> : null}</li>)}</ul></Card>
  </>
}
