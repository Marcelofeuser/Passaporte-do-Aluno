import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { financeCharge, financeInvoice, paymentSettlement, student } from '@/lib/db/schema'

export async function listFinanceInvoices(schoolId: string, studentIds?: string[]) {
  const filters = [eq(financeInvoice.schoolId, schoolId)]
  if (studentIds?.length) filters.push(inArray(financeInvoice.studentId, studentIds))
  return db.select({
    id: financeInvoice.id, studentId: financeInvoice.studentId, studentName: student.fullName,
    reference: financeInvoice.reference, dueOn: financeInvoice.dueOn, totalAmount: financeInvoice.totalAmount,
    status: financeInvoice.status, description: financeInvoice.description,
  }).from(financeInvoice).innerJoin(student, eq(student.id, financeInvoice.studentId))
    .where(and(...filters)).orderBy(desc(financeInvoice.dueOn))
}

export async function getFinanceStatement(schoolId: string, studentIds: string[]) {
  const invoices = await listFinanceInvoices(schoolId, studentIds)
  const settlements = invoices.length
    ? await db.select().from(paymentSettlement).where(and(eq(paymentSettlement.schoolId, schoolId), inArray(paymentSettlement.invoiceId, invoices.map((i) => i.id)), isNull(paymentSettlement.cancelledAt)))
    : []
  const charges = invoices.length
    ? await db.select().from(financeCharge).where(and(eq(financeCharge.schoolId, schoolId), inArray(financeCharge.invoiceId, invoices.map((i) => i.id))))
    : []
  return { invoices, settlements, charges }
}

export function settledAmount(
  invoiceId: string,
  settlements: Array<{ invoiceId: string; amount: number; cancelledAt: Date | null }>,
) {
  return settlements
    .filter((settlement) => settlement.invoiceId === invoiceId && settlement.cancelledAt === null)
    .reduce((total, settlement) => total + settlement.amount, 0)
}

export function effectiveInvoiceStatus(
  invoice: { status: string; dueOn: string },
  paidAmount: number,
  today = new Date().toISOString().slice(0, 10),
) {
  if (invoice.status === 'CANCELLED' || invoice.status === 'EXEMPT') return invoice.status
  if (paidAmount >= 0 && invoice.status === 'PAID') return 'PAID'
  return invoice.dueOn < today ? 'OVERDUE' : 'OPEN'
}
