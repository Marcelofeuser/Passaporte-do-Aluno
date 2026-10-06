'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { financeCategory, financeChargeType, financeInvoice, paymentPlan, paymentSettlement, student, studentPaymentPlan } from '@/lib/db/schema'
import { requireSchoolAction, runAction, UUID_RE } from '@/lib/school-action'
import { financeCategoryInput, financeChargeTypeInput, formText, invoiceInput, paymentPlanInput, settlementInput, studentPaymentPlanInput, toFieldErrors, type ActionState } from '@/lib/validation'

const CONFIG = 'school:manage_academic' as const
const FINANCE = 'school:manage_finance' as const
async function ownStudent(schoolId: string, studentId: string) {
  const [row] = await db.select({ id: student.id }).from(student).where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt))).limit(1)
  return Boolean(row)
}

async function ownPlan(schoolId: string, planId: string) {
  const [row] = await db.select({ id: paymentPlan.id }).from(paymentPlan).where(and(
    eq(paymentPlan.id, planId),
    eq(paymentPlan.schoolId, schoolId),
    eq(paymentPlan.active, true),
    isNull(paymentPlan.deletedAt),
  )).limit(1)
  return Boolean(row)
}
export async function createFinanceCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('finance.category_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(CONFIG); const p = financeCategoryInput.safeParse(formText(fd))
    if (!p.success) return { ok: false, fieldErrors: toFieldErrors(p.error) }
    await db.insert(financeCategory).values({ schoolId, ...p.data }); await recordAudit({ action: 'finance.category_created', entityType: 'finance_category', schoolId, actorUserId: userId }); revalidatePath('/school/finance')
    return { ok: true, message: 'Categoria criada.' }
  })
}
export async function createChargeType(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('finance.type_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(CONFIG); const p = financeChargeTypeInput.safeParse(formText(fd))
    if (!p.success) return { ok: false, fieldErrors: toFieldErrors(p.error) }
    await db.insert(financeChargeType).values({ schoolId, ...p.data }); await recordAudit({ action: 'finance.type_created', entityType: 'finance_charge_type', schoolId, actorUserId: userId }); revalidatePath('/school/finance')
    return { ok: true, message: 'Tipo de cobrança criado.' }
  })
}
export async function createPaymentPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('finance.plan_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(CONFIG); const p = paymentPlanInput.safeParse(formText(fd))
    if (!p.success) return { ok: false, fieldErrors: toFieldErrors(p.error) }
    await db.insert(paymentPlan).values({ schoolId, ...p.data }); await recordAudit({ action: 'finance.plan_created', entityType: 'payment_plan', schoolId, actorUserId: userId }); revalidatePath('/school/finance')
    return { ok: true, message: 'Plano criado.' }
  })
}
export async function assignPaymentPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('finance.plan_assign_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(FINANCE); const p = studentPaymentPlanInput.safeParse(formText(fd))
    if (!p.success) return { ok: false, fieldErrors: toFieldErrors(p.error) }
    if (!(await ownStudent(schoolId, p.data.studentId))) return { ok: false, message: 'Aluno não encontrado.' }
    if (!(await ownPlan(schoolId, p.data.planId))) return { ok: false, message: 'Plano não encontrado ou inativo.' }
    await db.insert(studentPaymentPlan).values({ schoolId, ...p.data }); await recordAudit({ action: 'finance.plan_assigned', entityType: 'student_payment_plan', schoolId, actorUserId: userId }); return { ok: true, message: 'Plano atribuído.' }
  })
}
export async function createInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('finance.invoice_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(FINANCE); const p = invoiceInput.safeParse(formText(fd))
    if (!p.success) return { ok: false, fieldErrors: toFieldErrors(p.error) }
    if (!(await ownStudent(schoolId, p.data.studentId))) return { ok: false, message: 'Aluno não encontrado.' }
    await db.insert(financeInvoice).values({ schoolId, studentId: p.data.studentId, reference: p.data.reference, dueOn: p.data.dueOn, totalAmount: p.data.amount, description: p.data.description, createdBy: userId })
    await recordAudit({ action: 'finance.invoice_created', entityType: 'finance_invoice', schoolId, actorUserId: userId }); revalidatePath('/school/finance'); revalidatePath('/family/finance'); return { ok: true, message: 'Fatura criada.' }
  })
}
export async function settleInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('finance.settlement_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(FINANCE); const p = settlementInput.safeParse(formText(fd))
    if (!p.success) return { ok: false, fieldErrors: toFieldErrors(p.error) }
    const [invoice] = await db.select().from(financeInvoice).where(and(eq(financeInvoice.id, p.data.invoiceId), eq(financeInvoice.schoolId, schoolId))).limit(1)
    if (!invoice) return { ok: false, message: 'Fatura não encontrada.' }
    if (invoice.status === 'CANCELLED' || invoice.status === 'EXEMPT' || invoice.status === 'PAID') {
      return { ok: false, message: 'Esta fatura não aceita novas baixas.' }
    }
    const settlements = await db.select({ amount: paymentSettlement.amount }).from(paymentSettlement).where(and(
      eq(paymentSettlement.schoolId, schoolId),
      eq(paymentSettlement.invoiceId, invoice.id),
      isNull(paymentSettlement.cancelledAt),
    ))
    const paidAmount = settlements.reduce((total, settlement) => total + settlement.amount, 0)
    if (paidAmount + p.data.amount > invoice.totalAmount) {
      return { ok: false, message: `O valor excede o saldo da fatura (R$ ${(invoice.totalAmount - paidAmount).toFixed(2)}).` }
    }
    await db.insert(paymentSettlement).values({ schoolId, invoiceId: invoice.id, amount: p.data.amount, paidOn: p.data.paidOn, method: p.data.method, retroactiveJustification: p.data.justification, createdBy: userId })
    await db.update(financeInvoice).set({
      status: paidAmount + p.data.amount >= invoice.totalAmount ? 'PAID' : 'OPEN',
      updatedAt: new Date(),
    }).where(and(eq(financeInvoice.id, invoice.id), eq(financeInvoice.schoolId, schoolId)))
    await recordAudit({ action: 'finance.invoice_settled', entityType: 'finance_invoice', entityId: invoice.id, schoolId, actorUserId: userId, metadata: { justification: p.data.justification } }); revalidatePath('/school/finance'); revalidatePath('/family/finance'); return { ok: true, message: 'Pagamento registrado.' }
  })
}
export async function cancelInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('finance.invoice_cancel_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(FINANCE); const id = String(fd.get('invoiceId') ?? ''), justification = String(fd.get('justification') ?? '').trim()
    if (!UUID_RE.test(id) || justification.length < 5) return { ok: false, message: 'Informe uma justificativa válida.' }
    const result = await db.update(financeInvoice).set({ status: 'CANCELLED', cancelledAt: new Date(), updatedAt: new Date() }).where(and(eq(financeInvoice.id, id), eq(financeInvoice.schoolId, schoolId))).returning({ id: financeInvoice.id })
    if (!result.length) return { ok: false, message: 'Fatura não encontrada.' }; await recordAudit({ action: 'finance.invoice_cancelled', entityType: 'finance_invoice', entityId: id, schoolId, actorUserId: userId, metadata: { justification } }); revalidatePath('/school/finance'); return { ok: true, message: 'Fatura cancelada.' }
  })
}
