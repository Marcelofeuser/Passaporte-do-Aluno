import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { book, bookCopy, bookLoan, bookLoanEvent, school, student, teacher, user } from '@/lib/db/schema'
import { DEFAULT_RULES, type BorrowerType, type LibraryRules, type LoanFilter } from '@/lib/library'

/* Todas as funções recebem `schoolId` do vínculo ativo validado no servidor. */

export async function getLibraryRules(schoolId: string): Promise<LibraryRules> {
  const [row] = await db
    .select({
      loanDays: school.libraryLoanDays,
      maxRenewals: school.libraryMaxRenewals,
      maxLoans: school.libraryMaxLoans,
      finePerDay: school.libraryFinePerDay,
      blockOverdue: school.libraryBlockOverdue,
      dueAlertDays: school.libraryDueAlertDays,
    })
    .from(school)
    .where(eq(school.id, schoolId))
  return row ?? DEFAULT_RULES
}

export async function getLibraryStats(schoolId: string, today?: string) {
  const day = today ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const [[titles], [copies], [loans]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(book)
      .where(and(eq(book.schoolId, schoolId), isNull(book.deletedAt))),
    db
      .select({
        total: sql<number>`count(*) filter (where ${bookCopy.status} <> 'WITHDRAWN')::int`,
        available: sql<number>`count(*) filter (where ${bookCopy.status} = 'AVAILABLE')::int`,
        loaned: sql<number>`count(*) filter (where ${bookCopy.status} = 'LOANED')::int`,
      })
      .from(bookCopy)
      .where(and(eq(bookCopy.schoolId, schoolId), isNull(bookCopy.deletedAt))),
    db
      .select({
        active: sql<number>`count(*) filter (where ${bookLoan.status} = 'ACTIVE')::int`,
        overdue: sql<number>`count(*) filter (where ${bookLoan.status} = 'ACTIVE' and ${bookLoan.dueOn} < ${day})::int`,
        pendingFines: sql<number>`coalesce(sum(${bookLoan.fineAmount}) filter (where ${bookLoan.fineStatus} = 'PENDING'), 0)::float`,
      })
      .from(bookLoan)
      .where(eq(bookLoan.schoolId, schoolId)),
  ])
  return {
    titles: titles.n,
    copies: copies.total,
    available: copies.available,
    loaned: copies.loaned,
    activeLoans: loans.active,
    overdue: loans.overdue,
    pendingFines: Number(loans.pendingFines),
  }
}

/* ---------- Acervo ---------- */

export async function listBooks(schoolId: string, opts: { q?: string; category?: string } = {}) {
  const where: SQL[] = [eq(book.schoolId, schoolId), isNull(book.deletedAt)]
  const q = opts.q?.trim()
  if (q) {
    where.push(or(ilike(book.title, `%${q}%`), ilike(book.authors, `%${q}%`), ilike(book.isbn, `%${q.replace(/[\s-]/g, '')}%`))!)
  }
  if (opts.category) where.push(eq(book.category, opts.category))
  return db
    .select({
      id: book.id,
      title: book.title,
      authors: book.authors,
      isbn: book.isbn,
      category: book.category,
      publishedYear: book.publishedYear,
      total: sql<number>`count(${bookCopy.id}) filter (where ${bookCopy.status} <> 'WITHDRAWN')::int`,
      available: sql<number>`count(${bookCopy.id}) filter (where ${bookCopy.status} = 'AVAILABLE')::int`,
      loaned: sql<number>`count(${bookCopy.id}) filter (where ${bookCopy.status} = 'LOANED')::int`,
    })
    .from(book)
    .leftJoin(bookCopy, and(eq(bookCopy.bookId, book.id), eq(bookCopy.schoolId, schoolId), isNull(bookCopy.deletedAt)))
    .where(and(...where))
    .groupBy(book.id)
    .orderBy(asc(book.title))
    .limit(300)
}

export async function listCategories(schoolId: string) {
  const rows = await db
    .selectDistinct({ category: book.category })
    .from(book)
    .where(and(eq(book.schoolId, schoolId), isNull(book.deletedAt), sql`${book.category} is not null`))
    .orderBy(asc(book.category))
  return rows.map((r) => r.category!).filter(Boolean)
}

export async function getBook(schoolId: string, bookId: string) {
  const [row] = await db
    .select()
    .from(book)
    .where(and(eq(book.id, bookId), eq(book.schoolId, schoolId), isNull(book.deletedAt)))
  return row ?? null
}

export async function listCopies(schoolId: string, bookId: string) {
  return db
    .select({
      id: bookCopy.id,
      code: bookCopy.code,
      condition: bookCopy.condition,
      status: bookCopy.status,
      notes: bookCopy.notes,
      loanId: bookLoan.id,
      dueOn: bookLoan.dueOn,
      borrowerName: sql<string | null>`coalesce(${student.socialName}, ${student.fullName}, ${teacher.fullName})`,
    })
    .from(bookCopy)
    .leftJoin(bookLoan, and(eq(bookLoan.copyId, bookCopy.id), eq(bookLoan.status, 'ACTIVE'), eq(bookLoan.schoolId, schoolId)))
    .leftJoin(student, and(eq(student.id, bookLoan.studentId), eq(student.schoolId, schoolId)))
    .leftJoin(teacher, and(eq(teacher.id, bookLoan.teacherId), eq(teacher.schoolId, schoolId)))
    .where(and(eq(bookCopy.schoolId, schoolId), eq(bookCopy.bookId, bookId), isNull(bookCopy.deletedAt)))
    .orderBy(asc(bookCopy.code))
}

/** Exemplares disponíveis para o campo de empréstimo (sugestões). */
export async function listAvailableCopies(schoolId: string, limit = 500) {
  return db
    .select({ id: bookCopy.id, code: bookCopy.code, title: book.title })
    .from(bookCopy)
    .innerJoin(book, and(eq(book.id, bookCopy.bookId), eq(book.schoolId, schoolId), isNull(book.deletedAt)))
    .where(and(eq(bookCopy.schoolId, schoolId), eq(bookCopy.status, 'AVAILABLE'), isNull(bookCopy.deletedAt)))
    .orderBy(asc(book.title), asc(bookCopy.code))
    .limit(limit)
}

export async function findCopyByCode(schoolId: string, code: string) {
  const [row] = await db
    .select({ id: bookCopy.id, code: bookCopy.code, status: bookCopy.status, bookId: bookCopy.bookId, title: book.title })
    .from(bookCopy)
    .innerJoin(book, and(eq(book.id, bookCopy.bookId), eq(book.schoolId, schoolId), isNull(book.deletedAt)))
    .where(and(eq(bookCopy.schoolId, schoolId), sql`lower(${bookCopy.code}) = lower(${code})`, isNull(bookCopy.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function getCopy(schoolId: string, copyId: string) {
  const [row] = await db
    .select()
    .from(bookCopy)
    .where(and(eq(bookCopy.id, copyId), eq(bookCopy.schoolId, schoolId), isNull(bookCopy.deletedAt)))
  return row ?? null
}

/* ---------- Tomadores ---------- */

export async function listBorrowerOptions(schoolId: string) {
  const [students, teachers] = await Promise.all([
    db
      .select({ id: student.id, name: sql<string>`coalesce(${student.socialName}, ${student.fullName})`, code: student.registrationCode })
      .from(student)
      .where(and(eq(student.schoolId, schoolId), isNull(student.deletedAt)))
      .orderBy(asc(student.fullName))
      .limit(2000),
    db
      .select({ id: teacher.id, name: teacher.fullName })
      .from(teacher)
      .where(and(eq(teacher.schoolId, schoolId), isNull(teacher.deletedAt)))
      .orderBy(asc(teacher.fullName)),
  ])
  return { students, teachers }
}

/** Nome do tomador, garantindo que pertence à escola. */
export async function getBorrower(schoolId: string, type: BorrowerType, id: string) {
  if (type === 'STUDENT') {
    const [row] = await db
      .select({ id: student.id, name: sql<string>`coalesce(${student.socialName}, ${student.fullName})` })
      .from(student)
      .where(and(eq(student.id, id), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
    return row ?? null
  }
  const [row] = await db
    .select({ id: teacher.id, name: teacher.fullName })
    .from(teacher)
    .where(and(eq(teacher.id, id), eq(teacher.schoolId, schoolId), isNull(teacher.deletedAt)))
  return row ?? null
}

/** Empréstimos ativos, atrasados e multas pendentes do tomador. */
export async function getBorrowerStanding(schoolId: string, type: BorrowerType, id: string, today: string) {
  const col = type === 'STUDENT' ? bookLoan.studentId : bookLoan.teacherId
  const [row] = await db
    .select({
      active: sql<number>`count(*) filter (where ${bookLoan.status} = 'ACTIVE')::int`,
      overdue: sql<number>`count(*) filter (where ${bookLoan.status} = 'ACTIVE' and ${bookLoan.dueOn} < ${today})::int`,
      pendingFines: sql<number>`count(*) filter (where ${bookLoan.fineStatus} = 'PENDING')::int`,
    })
    .from(bookLoan)
    .where(and(eq(bookLoan.schoolId, schoolId), eq(col, id)))
  return row ?? { active: 0, overdue: 0, pendingFines: 0 }
}

/* ---------- Empréstimos ---------- */

const loanColumns = {
  id: bookLoan.id,
  bookId: bookLoan.bookId,
  copyId: bookLoan.copyId,
  borrowerType: bookLoan.borrowerType,
  studentId: bookLoan.studentId,
  teacherId: bookLoan.teacherId,
  loanedOn: bookLoan.loanedOn,
  dueOn: bookLoan.dueOn,
  returnedOn: bookLoan.returnedOn,
  status: bookLoan.status,
  renewals: bookLoan.renewals,
  lateDays: bookLoan.lateDays,
  fineAmount: bookLoan.fineAmount,
  fineStatus: bookLoan.fineStatus,
  returnCondition: bookLoan.returnCondition,
  notes: bookLoan.notes,
  createdAt: bookLoan.createdAt,
  title: book.title,
  authors: book.authors,
  copyCode: bookCopy.code,
  borrowerName: sql<string>`coalesce(${student.socialName}, ${student.fullName}, ${teacher.fullName}, '—')`,
}

function loanQuery(schoolId: string) {
  return db
    .select(loanColumns)
    .from(bookLoan)
    .innerJoin(book, and(eq(book.id, bookLoan.bookId), eq(book.schoolId, schoolId)))
    .innerJoin(bookCopy, and(eq(bookCopy.id, bookLoan.copyId), eq(bookCopy.schoolId, schoolId)))
    .leftJoin(student, and(eq(student.id, bookLoan.studentId), eq(student.schoolId, schoolId)))
    .leftJoin(teacher, and(eq(teacher.id, bookLoan.teacherId), eq(teacher.schoolId, schoolId)))
}

export type LoanRow = Awaited<ReturnType<typeof listLoans>>[number]

export async function listLoans(
  schoolId: string,
  opts: { filter?: LoanFilter; q?: string; bookId?: string; studentIds?: string[]; from?: string; today: string; limit?: number },
) {
  const where: SQL[] = [eq(bookLoan.schoolId, schoolId)]
  switch (opts.filter ?? 'all') {
    case 'active':
      where.push(eq(bookLoan.status, 'ACTIVE'))
      break
    case 'overdue':
      where.push(eq(bookLoan.status, 'ACTIVE'), lt(bookLoan.dueOn, opts.today))
      break
    case 'fines':
      where.push(eq(bookLoan.fineStatus, 'PENDING'))
      break
    case 'closed':
      where.push(ne(bookLoan.status, 'ACTIVE'))
      break
  }
  const q = opts.q?.trim()
  if (q) {
    where.push(
      or(
        ilike(book.title, `%${q}%`),
        ilike(bookCopy.code, `%${q}%`),
        ilike(student.fullName, `%${q}%`),
        ilike(student.socialName, `%${q}%`),
        ilike(student.registrationCode, `%${q}%`),
        ilike(teacher.fullName, `%${q}%`),
      )!,
    )
  }
  if (opts.bookId) where.push(eq(bookLoan.bookId, opts.bookId))
  if (opts.studentIds) {
    if (opts.studentIds.length === 0) return []
    where.push(inArray(bookLoan.studentId, opts.studentIds))
  }
  if (opts.from) where.push(gte(bookLoan.loanedOn, opts.from))
  const active = opts.filter === 'active' || opts.filter === 'overdue'
  return loanQuery(schoolId)
    .where(and(...where))
    .orderBy(active ? asc(bookLoan.dueOn) : desc(bookLoan.createdAt))
    .limit(opts.limit ?? 100)
}

export async function getLoan(schoolId: string, loanId: string) {
  const [row] = await loanQuery(schoolId).where(and(eq(bookLoan.schoolId, schoolId), eq(bookLoan.id, loanId)))
  return row ?? null
}

export async function getLoanEvents(schoolId: string, loanId: string) {
  return db
    .select({
      id: bookLoanEvent.id,
      kind: bookLoanEvent.kind,
      oldDueOn: bookLoanEvent.oldDueOn,
      newDueOn: bookLoanEvent.newDueOn,
      reason: bookLoanEvent.reason,
      metadata: bookLoanEvent.metadata,
      createdAt: bookLoanEvent.createdAt,
      actorName: user.name,
    })
    .from(bookLoanEvent)
    .leftJoin(user, eq(user.id, bookLoanEvent.actorUserId))
    .where(and(eq(bookLoanEvent.schoolId, schoolId), eq(bookLoanEvent.loanId, loanId)))
    .orderBy(desc(bookLoanEvent.createdAt))
}

/** Empréstimos ativos cujo prazo vence até `until` (inclusive), para alertas. */
export async function listActiveLoansDueBy(schoolId: string, until: string) {
  return loanQuery(schoolId)
    .where(and(eq(bookLoan.schoolId, schoolId), eq(bookLoan.status, 'ACTIVE'), lte(bookLoan.dueOn, until)))
    .orderBy(asc(bookLoan.dueOn))
}
