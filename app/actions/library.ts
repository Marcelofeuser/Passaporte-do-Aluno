'use server'

import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { book, bookCopy, bookLoan, bookLoanEvent, school } from '@/lib/db/schema'
import { isISODate, todayISO } from '@/lib/attendance'
import {
  addDays,
  computeFine,
  COPY_CONDITIONS,
  COPY_STATUS,
  daysBetween,
  formatMoney,
  MANUAL_COPY_STATUS,
  MIN_REASON,
  parseBorrower,
  type CopyCondition,
  type LoanEventKind,
} from '@/lib/library'
import { formatBR, notifyBorrower } from '@/lib/library-alerts'
import {
  findCopyByCode,
  getBook,
  getBorrower,
  getBorrowerStanding,
  getCopy,
  getLibraryRules,
  getLoan,
} from '@/lib/library-queries'
import { requireSchoolAction, runAction, UUID_RE } from '@/lib/school-action'
import { bookInput, formText, libraryRulesInput, newBookInput, toFieldErrors, type ActionState } from '@/lib/validation'

const MANAGE = 'school:manage_library' as const

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Exemplar mudou de situação entre a leitura e a gravação (corrida entre operadores). */
class ConflictError extends Error {}

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? '').trim().slice(0, max)
}

function isCondition(value: unknown): value is CopyCondition {
  return typeof value === 'string' && value in COPY_CONDITIONS
}

function refresh() {
  revalidatePath('/school/library', 'layout')
  revalidatePath('/family/library')
}

async function isbnTaken(schoolId: string, isbn: string | null | undefined, exceptId?: string) {
  if (!isbn) return false
  const where = [eq(book.schoolId, schoolId), eq(book.isbn, isbn), isNull(book.deletedAt)]
  if (exceptId) where.push(ne(book.id, exceptId))
  const [row] = await db.select({ id: book.id }).from(book).where(and(...where)).limit(1)
  return Boolean(row)
}

async function codeTaken(schoolId: string, code: string) {
  const [row] = await db
    .select({ id: bookCopy.id })
    .from(bookCopy)
    .where(and(eq(bookCopy.schoolId, schoolId), sql`lower(${bookCopy.code}) = lower(${code})`, isNull(bookCopy.deletedAt)))
    .limit(1)
  return Boolean(row)
}

/** Próximos códigos de tombo numéricos da escola (000001, 000002…). */
async function nextCopyCodes(tx: Tx, schoolId: string, n: number) {
  const [row] = await tx
    .select({
      max: sql<string>`coalesce(max(case when ${bookCopy.code} ~ '^[0-9]{1,15}$' then (${bookCopy.code})::bigint end), 0)`,
    })
    .from(bookCopy)
    .where(eq(bookCopy.schoolId, schoolId))
  const start = Number(row?.max ?? 0) + 1
  return Array.from({ length: n }, (_, i) => String(start + i).padStart(6, '0'))
}

/* ---------- Acervo ---------- */

export async function createBook(_: ActionState, formData: FormData): Promise<ActionState> {
  let createdId: string | null = null
  const result = await runAction('library.book_create_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = newBookInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { copies, ...data } = parsed.data
    const condition = isCondition(formData.get('condition')) ? (formData.get('condition') as CopyCondition) : 'NEW'
    if (await isbnTaken(schoolId, data.isbn)) {
      return { ok: false, fieldErrors: { isbn: 'Já existe um título com este ISBN no acervo.' } }
    }

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(book)
        .values({ ...data, schoolId, createdBy: userId })
        .returning({ id: book.id })
      if (copies > 0) {
        const codes = await nextCopyCodes(tx, schoolId, copies)
        await tx.insert(bookCopy).values(codes.map((code) => ({ schoolId, bookId: row.id, code, condition })))
      }
      return row.id
    })
    createdId = id

    await recordAudit({
      action: 'library.book_created',
      entityType: 'book',
      entityId: id,
      schoolId,
      actorUserId: userId,
      metadata: { title: data.title, isbn: data.isbn, copies },
    })
    refresh()
    return { ok: true, message: 'Título cadastrado.' }
  })
  if (createdId) redirect(`/school/library/books/${createdId}`)
  return result
}

export async function updateBook(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('library.book_update_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const bookId = String(formData.get('bookId') ?? '')
    if (!UUID_RE.test(bookId)) return { ok: false, message: 'Título inválido.' }
    const current = await getBook(schoolId, bookId)
    if (!current) return { ok: false, message: 'Título não encontrado.' }
    const parsed = bookInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    if (await isbnTaken(schoolId, parsed.data.isbn, bookId)) {
      return { ok: false, fieldErrors: { isbn: 'Já existe outro título com este ISBN no acervo.' } }
    }

    const changed = Object.fromEntries(
      Object.entries(parsed.data)
        .filter(([k, v]) => (current as Record<string, unknown>)[k] !== v)
        .map(([k, v]) => [k, { from: (current as Record<string, unknown>)[k] ?? null, to: v ?? null }]),
    )
    await db
      .update(book)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(book.id, bookId), eq(book.schoolId, schoolId)))
    await recordAudit({
      action: 'library.book_updated',
      entityType: 'book',
      entityId: bookId,
      schoolId,
      actorUserId: userId,
      metadata: { changed },
    })
    refresh()
    return { ok: true, message: 'Dados do título salvos.' }
  })
}

export async function archiveBook(_: ActionState, formData: FormData): Promise<ActionState> {
  let archived = false
  const result = await runAction('library.book_archive_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const bookId = String(formData.get('bookId') ?? '')
    const reason = text(formData, 'reason', 500)
    if (!UUID_RE.test(bookId)) return { ok: false, message: 'Título inválido.' }
    if (reason.length < MIN_REASON) return { ok: false, fieldErrors: { reason: 'Informe o motivo da baixa (mín. 5 caracteres).' } }
    const current = await getBook(schoolId, bookId)
    if (!current) return { ok: false, message: 'Título não encontrado.' }

    const [loaned] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookLoan)
      .where(and(eq(bookLoan.schoolId, schoolId), eq(bookLoan.bookId, bookId), eq(bookLoan.status, 'ACTIVE')))
    if (loaned.n > 0) return { ok: false, message: `Há ${loaned.n} exemplar(es) emprestado(s). Registre a devolução antes da baixa.` }

    const now = new Date()
    await db.transaction(async (tx) => {
      await tx.update(book).set({ deletedAt: now, updatedAt: now }).where(and(eq(book.id, bookId), eq(book.schoolId, schoolId)))
      await tx
        .update(bookCopy)
        .set({ status: 'WITHDRAWN', deletedAt: now, updatedAt: now })
        .where(and(eq(bookCopy.bookId, bookId), eq(bookCopy.schoolId, schoolId), isNull(bookCopy.deletedAt)))
    })
    await recordAudit({
      action: 'library.book_archived',
      entityType: 'book',
      entityId: bookId,
      schoolId,
      actorUserId: userId,
      metadata: { title: current.title, reason },
    })
    archived = true
    refresh()
    return { ok: true, message: 'Título baixado do acervo.' }
  })
  if (archived) redirect('/school/library/books')
  return result
}

/* ---------- Exemplares ---------- */

export async function addCopies(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('library.copies_add_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const bookId = String(formData.get('bookId') ?? '')
    const quantity = Number(formData.get('quantity') ?? 1)
    const code = text(formData, 'code', 30)
    const condition = formData.get('condition')
    if (!UUID_RE.test(bookId) || !(await getBook(schoolId, bookId))) return { ok: false, message: 'Título não encontrado.' }

    const fieldErrors: Record<string, string> = {}
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) fieldErrors.quantity = 'Entre 1 e 100.'
    if (!isCondition(condition)) fieldErrors.condition = 'Selecione o estado de conservação.'
    if (code && quantity !== 1) fieldErrors.code = 'Informe o código apenas ao adicionar um exemplar.'
    if (code && !/^[\w./-]+$/.test(code)) fieldErrors.code = 'Use letras, números, ponto, barra ou hífen.'
    if (!fieldErrors.code && code && (await codeTaken(schoolId, code))) fieldErrors.code = 'Já existe um exemplar com este código.'
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

    const codes = await db.transaction(async (tx) => {
      const list = code ? [code] : await nextCopyCodes(tx, schoolId, quantity)
      await tx.insert(bookCopy).values(list.map((c) => ({ schoolId, bookId, code: c, condition: condition as CopyCondition })))
      return list
    })
    await recordAudit({
      action: 'library.copies_added',
      entityType: 'book',
      entityId: bookId,
      schoolId,
      actorUserId: userId,
      metadata: { codes, condition },
    })
    refresh()
    return { ok: true, message: codes.length === 1 ? `Exemplar ${codes[0]} adicionado.` : `${codes.length} exemplares adicionados.` }
  })
}

export async function updateCopy(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('library.copy_update_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const copyId = String(formData.get('copyId') ?? '')
    if (!UUID_RE.test(copyId)) return { ok: false, message: 'Exemplar inválido.' }
    const copy = await getCopy(schoolId, copyId)
    if (!copy) return { ok: false, message: 'Exemplar não encontrado.' }

    const condition = formData.get('condition')
    const rawStatus = String(formData.get('status') ?? copy.status)
    const notes = text(formData, 'notes', 300) || null
    const reason = text(formData, 'reason', 500)
    if (!isCondition(condition)) return { ok: false, fieldErrors: { condition: 'Estado de conservação inválido.' } }

    // Exemplar emprestado só muda de situação pela devolução/extravio do empréstimo.
    const status = copy.status === 'LOANED' ? 'LOANED' : rawStatus
    if (status !== 'LOANED' && !(MANUAL_COPY_STATUS as readonly string[]).includes(status)) {
      return { ok: false, fieldErrors: { status: 'Situação inválida.' } }
    }
    const statusChanged = status !== copy.status
    if (statusChanged && reason.length < MIN_REASON) {
      return { ok: false, fieldErrors: { reason: 'Justifique a mudança de situação (mín. 5 caracteres).' } }
    }

    const [updated] = await db
      .update(bookCopy)
      .set({ condition, status, notes, updatedAt: new Date() })
      .where(and(eq(bookCopy.id, copyId), eq(bookCopy.schoolId, schoolId), eq(bookCopy.status, copy.status)))
      .returning({ id: bookCopy.id })
    if (!updated) return { ok: false, message: 'O exemplar foi alterado por outra pessoa. Recarregue a página.' }

    await recordAudit({
      action: 'library.copy_updated',
      entityType: 'book_copy',
      entityId: copyId,
      schoolId,
      actorUserId: userId,
      metadata: {
        code: copy.code,
        condition: { from: copy.condition, to: condition },
        status: { from: copy.status, to: status },
        ...(reason ? { reason } : {}),
      },
    })
    refresh()
    return { ok: true, message: `Exemplar ${copy.code} atualizado.` }
  })
}

/* ---------- Empréstimos ---------- */

export async function createLoan(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('library.loan_create_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const today = todayISO()
    const rules = await getLibraryRules(schoolId)

    const code = text(formData, 'copyCode', 30)
    const borrower = parseBorrower(formData.get('borrower'))
    const loanedOn = text(formData, 'loanedOn', 10) || today
    const dueOnRaw = text(formData, 'dueOn', 10)
    const reason = text(formData, 'reason', 500)
    const notes = text(formData, 'notes', 500) || null

    const fieldErrors: Record<string, string> = {}
    if (!code) fieldErrors.copyCode = 'Informe o código (tombo) do exemplar.'
    if (!borrower) fieldErrors.borrower = 'Selecione o aluno ou professor.'
    if (!isISODate(loanedOn)) fieldErrors.loanedOn = 'Data inválida.'
    else if (loanedOn > today) fieldErrors.loanedOn = 'O empréstimo não pode ter data futura.'
    const defaultDue = isISODate(loanedOn) ? addDays(loanedOn, rules.loanDays) : ''
    const dueOn = dueOnRaw || defaultDue
    if (dueOnRaw && !isISODate(dueOnRaw)) fieldErrors.dueOn = 'Data inválida.'
    else if (dueOn && dueOn <= loanedOn) fieldErrors.dueOn = 'A devolução deve ser posterior à data do empréstimo.'
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

    const manual: string[] = []
    if (loanedOn !== today) manual.push('data retroativa')
    if (dueOn !== defaultDue) manual.push(`prazo diferente da regra de ${rules.loanDays} dias`)
    if (manual.length && reason.length < MIN_REASON) {
      return { ok: false, fieldErrors: { reason: `Justifique a intervenção manual (${manual.join(', ')}).` } }
    }

    const copy = await findCopyByCode(schoolId, code)
    if (!copy) return { ok: false, fieldErrors: { copyCode: 'Exemplar não encontrado no acervo.' } }
    if (copy.status !== 'AVAILABLE') {
      return {
        ok: false,
        fieldErrors: { copyCode: `Exemplar ${copy.code} está "${COPY_STATUS[copy.status as keyof typeof COPY_STATUS] ?? copy.status}".` },
      }
    }
    const person = await getBorrower(schoolId, borrower!.type, borrower!.id)
    if (!person) return { ok: false, fieldErrors: { borrower: 'Tomador não encontrado nesta escola.' } }

    const standing = await getBorrowerStanding(schoolId, borrower!.type, person.id, today)
    if (standing.active >= rules.maxLoans) {
      return { ok: false, message: `${person.name} já atingiu o limite de ${rules.maxLoans} empréstimo(s) simultâneo(s).` }
    }
    if (rules.blockOverdue && (standing.overdue > 0 || standing.pendingFines > 0)) {
      const issues = [
        standing.overdue ? `${standing.overdue} empréstimo(s) em atraso` : null,
        standing.pendingFines ? `${standing.pendingFines} multa(s) pendente(s)` : null,
      ].filter(Boolean)
      return { ok: false, message: `Empréstimo bloqueado: ${person.name} possui ${issues.join(' e ')}. Regularize antes de emprestar.` }
    }

    const studentId = borrower!.type === 'STUDENT' ? person.id : null
    const teacherId = borrower!.type === 'TEACHER' ? person.id : null
    let loanId: string
    try {
      loanId = await db.transaction(async (tx) => {
        const claimed = await tx
          .update(bookCopy)
          .set({ status: 'LOANED', updatedAt: new Date() })
          .where(and(eq(bookCopy.id, copy.id), eq(bookCopy.schoolId, schoolId), eq(bookCopy.status, 'AVAILABLE'), isNull(bookCopy.deletedAt)))
          .returning({ id: bookCopy.id })
        if (claimed.length === 0) throw new ConflictError()
        const [row] = await tx
          .insert(bookLoan)
          .values({
            schoolId,
            copyId: copy.id,
            bookId: copy.bookId,
            borrowerType: borrower!.type,
            studentId,
            teacherId,
            loanedOn,
            dueOn,
            notes,
            createdBy: userId,
          })
          .returning({ id: bookLoan.id })
        await tx.insert(bookLoanEvent).values({
          schoolId,
          loanId: row.id,
          kind: 'CREATED',
          newDueOn: dueOn,
          reason: manual.length ? reason : null,
          metadata: { loanedOn, copyCode: copy.code, manual },
          actorUserId: userId,
        })
        return row.id
      })
    } catch (error) {
      if (error instanceof ConflictError) return { ok: false, message: 'Este exemplar acabou de ser emprestado. Escolha outro.' }
      throw error
    }

    await recordAudit({
      action: 'library.loan_created',
      entityType: 'book_loan',
      entityId: loanId,
      schoolId,
      actorUserId: userId,
      metadata: { copyId: copy.id, copyCode: copy.code, borrowerType: borrower!.type, borrowerId: person.id, loanedOn, dueOn, manual, ...(manual.length ? { reason } : {}) },
    })
    await notifyBorrower(
      schoolId,
      { borrowerType: borrower!.type, studentId, teacherId },
      `Empréstimo de livro: ${copy.title}`,
      `${person.name} · devolver até ${formatBR(dueOn)}`,
    )
    refresh()
    return { ok: true, message: `Empréstimo registrado: ${copy.title} (${copy.code}) para ${person.name}, devolução até ${formatBR(dueOn)}.` }
  })
}

async function activeLoan(schoolId: string, formData: FormData) {
  const loanId = String(formData.get('loanId') ?? '')
  if (!UUID_RE.test(loanId)) return null
  const loan = await getLoan(schoolId, loanId)
  return loan && loan.status === 'ACTIVE' ? loan : null
}

export async function renewLoan(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('library.loan_renew_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const loan = await activeLoan(schoolId, formData)
    if (!loan) return { ok: false, message: 'Empréstimo não encontrado ou já encerrado.' }
    const today = todayISO()
    const rules = await getLibraryRules(schoolId)
    const reason = text(formData, 'reason', 500)
    const dueOnRaw = text(formData, 'dueOn', 10)

    const overdue = loan.dueOn < today
    const computed = addDays(overdue ? today : loan.dueOn, rules.loanDays)
    const newDue = dueOnRaw || computed
    if (!isISODate(newDue)) return { ok: false, fieldErrors: { dueOn: 'Data inválida.' } }
    if (newDue <= today || newDue <= loan.dueOn) {
      return { ok: false, fieldErrors: { dueOn: 'A nova data deve ser posterior a hoje e ao prazo atual.' } }
    }

    const manual: string[] = []
    if (overdue) manual.push('empréstimo em atraso')
    if (loan.renewals >= rules.maxRenewals) manual.push(`limite de ${rules.maxRenewals} renovação(ões) atingido`)
    if (newDue !== computed) manual.push(`prazo diferente da regra de ${rules.loanDays} dias`)
    if (manual.length && reason.length < MIN_REASON) {
      return { ok: false, fieldErrors: { reason: `Justifique a renovação (${manual.join(', ')}).` } }
    }

    const ok = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(bookLoan)
        .set({
          dueOn: newDue,
          renewals: sql`${bookLoan.renewals} + 1`,
          dueAlertSentAt: null,
          overdueAlertSentAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(bookLoan.id, loan.id), eq(bookLoan.schoolId, schoolId), eq(bookLoan.status, 'ACTIVE'), eq(bookLoan.dueOn, loan.dueOn)))
        .returning({ id: bookLoan.id })
      if (!row) return false
      await tx.insert(bookLoanEvent).values({
        schoolId,
        loanId: loan.id,
        kind: 'RENEWED',
        oldDueOn: loan.dueOn,
        newDueOn: newDue,
        reason: reason || null,
        metadata: { renewal: loan.renewals + 1, manual },
        actorUserId: userId,
      })
      return true
    })
    if (!ok) return { ok: false, message: 'O empréstimo foi alterado por outra pessoa. Recarregue a página.' }

    await recordAudit({
      action: 'library.loan_renewed',
      entityType: 'book_loan',
      entityId: loan.id,
      schoolId,
      actorUserId: userId,
      metadata: { from: loan.dueOn, to: newDue, renewal: loan.renewals + 1, manual, ...(reason ? { reason } : {}) },
    })
    await notifyBorrower(schoolId, loan, `Prazo renovado: ${loan.title}`, `${loan.borrowerName} · nova data de devolução ${formatBR(newDue)}`)
    refresh()
    return { ok: true, message: `Prazo renovado até ${formatBR(newDue)}.` }
  })
}

/** Ações que encerram o formulário de origem voltam ao empréstimo com um aviso de confirmação. */
function backToLoan(loanId: string | null, done: string) {
  if (loanId) redirect(`/school/library/loans/${loanId}?done=${done}`)
}

export async function returnLoan(_: ActionState, formData: FormData): Promise<ActionState> {
  let doneId: string | null = null
  const result = await runAction('library.loan_return_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const loan = await activeLoan(schoolId, formData)
    if (!loan) return { ok: false, message: 'Empréstimo não encontrado ou já encerrado.' }
    const today = todayISO()
    const rules = await getLibraryRules(schoolId)
    const returnedOn = text(formData, 'returnedOn', 10) || today
    const condition = formData.get('condition')
    const reason = text(formData, 'reason', 500)
    const notes = text(formData, 'notes', 500)

    const fieldErrors: Record<string, string> = {}
    if (!isISODate(returnedOn)) fieldErrors.returnedOn = 'Data inválida.'
    else if (returnedOn > today) fieldErrors.returnedOn = 'A devolução não pode ter data futura.'
    else if (returnedOn < loan.loanedOn) fieldErrors.returnedOn = 'A devolução não pode ser anterior ao empréstimo.'
    if (!isCondition(condition)) fieldErrors.condition = 'Informe o estado de conservação na devolução.'
    if (!fieldErrors.returnedOn && returnedOn !== today && reason.length < MIN_REASON) {
      fieldErrors.reason = 'Justifique a devolução com data retroativa (mín. 5 caracteres).'
    }
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

    const lateDays = Math.max(0, daysBetween(loan.dueOn, returnedOn))
    const fine = computeFine(lateDays, rules.finePerDay)
    const copyStatus = condition === 'DAMAGED' ? 'MAINTENANCE' : 'AVAILABLE'

    const ok = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(bookLoan)
        .set({
          status: 'RETURNED',
          returnedOn,
          lateDays,
          fineAmount: fine,
          fineStatus: fine > 0 ? 'PENDING' : 'NONE',
          returnCondition: condition as CopyCondition,
          notes: notes ? [loan.notes, `Devolução: ${notes}`].filter(Boolean).join('\n') : loan.notes,
          closedBy: userId,
          updatedAt: new Date(),
        })
        .where(and(eq(bookLoan.id, loan.id), eq(bookLoan.schoolId, schoolId), eq(bookLoan.status, 'ACTIVE')))
        .returning({ id: bookLoan.id })
      if (!row) return false
      await tx
        .update(bookCopy)
        .set({ status: copyStatus, condition: condition as CopyCondition, updatedAt: new Date() })
        .where(and(eq(bookCopy.id, loan.copyId), eq(bookCopy.schoolId, schoolId)))
      await tx.insert(bookLoanEvent).values({
        schoolId,
        loanId: loan.id,
        kind: 'RETURNED',
        oldDueOn: loan.dueOn,
        reason: reason || null,
        metadata: { returnedOn, lateDays, fine, condition, copyStatus },
        actorUserId: userId,
      })
      return true
    })
    if (!ok) return { ok: false, message: 'O empréstimo já foi encerrado por outra pessoa.' }

    await recordAudit({
      action: 'library.loan_returned',
      entityType: 'book_loan',
      entityId: loan.id,
      schoolId,
      actorUserId: userId,
      metadata: { returnedOn, lateDays, fine, condition, ...(reason ? { reason } : {}) },
    })
    const summary =
      lateDays > 0
        ? `com ${lateDays} dia(s) de atraso${fine > 0 ? ` · multa de ${formatMoney(fine)}` : ''}`
        : 'no prazo'
    await notifyBorrower(schoolId, loan, `Livro devolvido: ${loan.title}`, `${loan.borrowerName} · devolvido em ${formatBR(returnedOn)} ${summary}`)
    refresh()
    doneId = loan.id
    return { ok: true, message: `Devolução registrada ${summary}.` }
  })
  backToLoan(doneId, 'returned')
  return result
}

/** Encerramento excepcional (anulação ou extravio), sempre com justificativa. */
async function closeLoan(formData: FormData, kind: Extract<LoanEventKind, 'CANCELLED' | 'LOST'>): Promise<ActionState> {
  const { schoolId, userId } = await requireSchoolAction(MANAGE)
  const loan = await activeLoan(schoolId, formData)
  if (!loan) return { ok: false, message: 'Empréstimo não encontrado ou já encerrado.' }
  const reason = text(formData, 'reason', 500)
  if (reason.length < MIN_REASON) {
    return { ok: false, fieldErrors: { reason: 'A justificativa é obrigatória (mín. 5 caracteres).' } }
  }

  const ok = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(bookLoan)
      .set({ status: kind, closedBy: userId, updatedAt: new Date() })
      .where(and(eq(bookLoan.id, loan.id), eq(bookLoan.schoolId, schoolId), eq(bookLoan.status, 'ACTIVE')))
      .returning({ id: bookLoan.id })
    if (!row) return false
    await tx
      .update(bookCopy)
      .set({ status: kind === 'LOST' ? 'LOST' : 'AVAILABLE', updatedAt: new Date() })
      .where(and(eq(bookCopy.id, loan.copyId), eq(bookCopy.schoolId, schoolId)))
    await tx.insert(bookLoanEvent).values({
      schoolId,
      loanId: loan.id,
      kind,
      oldDueOn: loan.dueOn,
      reason,
      metadata: { copyCode: loan.copyCode },
      actorUserId: userId,
    })
    return true
  })
  if (!ok) return { ok: false, message: 'O empréstimo já foi encerrado por outra pessoa.' }

  await recordAudit({
    action: kind === 'LOST' ? 'library.loan_lost' : 'library.loan_cancelled',
    entityType: 'book_loan',
    entityId: loan.id,
    schoolId,
    actorUserId: userId,
    metadata: { copyCode: loan.copyCode, reason },
  })
  refresh()
  return { ok: true, message: kind === 'LOST' ? 'Extravio registrado.' : 'Empréstimo anulado.' }
}

export async function cancelLoan(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction('library.loan_cancel_failed', () => closeLoan(formData, 'CANCELLED'))
  if (result.ok) backToLoan(String(formData.get('loanId')), 'cancelled')
  return result
}

export async function markLoanLost(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction('library.loan_lost_failed', () => closeLoan(formData, 'LOST'))
  if (result.ok) backToLoan(String(formData.get('loanId')), 'lost')
  return result
}

export async function settleFine(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction('library.fine_settle_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const loanId = String(formData.get('loanId') ?? '')
    const outcome = formData.get('outcome')
    const reason = text(formData, 'reason', 500)
    if (!UUID_RE.test(loanId)) return { ok: false, message: 'Empréstimo inválido.' }
    if (outcome !== 'PAID' && outcome !== 'WAIVED') return { ok: false, fieldErrors: { outcome: 'Selecione a baixa da multa.' } }
    if (outcome === 'WAIVED' && reason.length < MIN_REASON) {
      return { ok: false, fieldErrors: { reason: 'Justifique a dispensa da multa (mín. 5 caracteres).' } }
    }
    const loan = await getLoan(schoolId, loanId)
    if (!loan || loan.fineStatus !== 'PENDING') return { ok: false, message: 'Não há multa pendente neste empréstimo.' }

    const ok = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(bookLoan)
        .set({ fineStatus: outcome, updatedAt: new Date() })
        .where(and(eq(bookLoan.id, loanId), eq(bookLoan.schoolId, schoolId), eq(bookLoan.fineStatus, 'PENDING')))
        .returning({ id: bookLoan.id })
      if (!row) return false
      await tx.insert(bookLoanEvent).values({
        schoolId,
        loanId,
        kind: outcome === 'PAID' ? 'FINE_PAID' : 'FINE_WAIVED',
        reason: reason || null,
        metadata: { amount: loan.fineAmount },
        actorUserId: userId,
      })
      return true
    })
    if (!ok) return { ok: false, message: 'A multa já foi baixada por outra pessoa.' }

    await recordAudit({
      action: outcome === 'PAID' ? 'library.fine_paid' : 'library.fine_waived',
      entityType: 'book_loan',
      entityId: loanId,
      schoolId,
      actorUserId: userId,
      metadata: { amount: loan.fineAmount, ...(reason ? { reason } : {}) },
    })
    refresh()
    return { ok: true, message: outcome === 'PAID' ? 'Multa quitada.' : 'Multa dispensada.' }
  })
  if (result.ok) backToLoan(String(formData.get('loanId')), 'fine')
  return result
}

/* ---------- Regras ---------- */

export async function updateLibraryRules(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('library.rules_update_failed', async (): Promise<ActionState> => {
    const { schoolId, userId } = await requireSchoolAction('school:configure_library')
    const parsed = libraryRulesInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const r = parsed.data
    const previous = await getLibraryRules(schoolId)
    await db
      .update(school)
      .set({
        libraryLoanDays: r.loanDays,
        libraryMaxRenewals: r.maxRenewals,
        libraryMaxLoans: r.maxLoans,
        libraryFinePerDay: r.finePerDay,
        libraryBlockOverdue: r.blockOverdue,
        libraryDueAlertDays: r.dueAlertDays,
        updatedAt: new Date(),
      })
      .where(eq(school.id, schoolId))
    await recordAudit({
      action: 'library.rules_updated',
      entityType: 'school',
      entityId: schoolId,
      schoolId,
      actorUserId: userId,
      metadata: { previous, next: r },
    })
    refresh()
    return { ok: true, message: 'Regras da biblioteca salvas.' }
  })
}
