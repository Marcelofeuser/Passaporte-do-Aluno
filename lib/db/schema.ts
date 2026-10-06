import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const tz = { withTimezone: true } as const

/* ---------- Better Auth (colunas camelCase, não renomear) ---------- */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt', tz).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', tz).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', tz).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', tz).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', tz).notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', tz),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', tz),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', tz).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', tz).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', tz).notNull(),
  createdAt: timestamp('createdAt', tz).defaultNow(),
  updatedAt: timestamp('updatedAt', tz).defaultNow(),
})

/* ---------- Domínio escolar ---------- */

const address = () => ({
  addressZip: text('address_zip'),
  addressStreet: text('address_street'),
  addressNumber: text('address_number'),
  addressComplement: text('address_complement'),
  addressDistrict: text('address_district'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
})

export const school = pgTable('school', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  cnpj: text('cnpj'),
  email: text('email'),
  phone: text('phone'),
  legalName: text('legal_name'),
  inepCode: text('inep_code'),
  stateRegistration: text('state_registration'),
  directorName: text('director_name'),
  website: text('website'),
  ...address(),
  logoPathname: text('logo_pathname'),
  passingGrade: numeric('passing_grade', { precision: 4, scale: 2, mode: 'number' }).notNull().default(6),
  minAttendance: integer('min_attendance').notNull().default(75),
  lateAlertThreshold: integer('late_alert_threshold').notNull().default(3),
  libraryLoanDays: integer('library_loan_days').notNull().default(14),
  libraryMaxRenewals: integer('library_max_renewals').notNull().default(2),
  libraryMaxLoans: integer('library_max_loans').notNull().default(3),
  libraryFinePerDay: numeric('library_fine_per_day', { precision: 8, scale: 2, mode: 'number' }).notNull().default(0),
  libraryBlockOverdue: boolean('library_block_overdue').notNull().default(true),
  libraryDueAlertDays: integer('library_due_alert_days').notNull().default(2),
  occurrenceAlertThreshold: integer('occurrence_alert_threshold').notNull().default(3),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const schoolMembership = pgTable('school_membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  schoolId: uuid('school_id'),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const academicYear = pgTable('academic_year', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  year: integer('year').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

/* ---------- Calendário e atendimentos ---------- */

export const calendarEventType = pgTable('calendar_event_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('BLUE'),
  audience: text('audience').notNull().default('ALL'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const calendarEvent = pgTable('calendar_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  typeId: uuid('type_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startsAt: timestamp('starts_at', tz).notNull(),
  endsAt: timestamp('ends_at', tz),
  location: text('location'),
  isSchoolDay: boolean('is_school_day').notNull().default(true),
  alertSentAt: timestamp('alert_sent_at', tz),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const schoolDay = pgTable('school_day', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  day: date('day').notNull(),
  isSchoolDay: boolean('is_school_day').notNull(),
  reason: text('reason'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
})

export const appointmentSlot = pgTable('appointment_slot', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  teacherId: uuid('teacher_id'),
  startsAt: timestamp('starts_at', tz).notNull(),
  endsAt: timestamp('ends_at', tz).notNull(),
  capacity: integer('capacity').notNull().default(1),
  location: text('location'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const appointment = pgTable('appointment', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  slotId: uuid('slot_id').notNull(),
  studentId: uuid('student_id').notNull(),
  bookedBy: text('booked_by').notNull(),
  status: text('status').notNull().default('BOOKED'),
  notes: text('notes'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
})

export const student = pgTable('student', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  userId: text('user_id'),
  fullName: text('full_name').notNull(),
  socialName: text('social_name'),
  birthDate: date('birth_date'),
  registrationCode: text('registration_code'),
  sex: text('sex'),
  cpf: text('cpf'),
  photoPathname: text('photo_pathname'),
  email: text('email'),
  phone: text('phone'),
  ...address(),
  notes: text('notes'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const parent = pgTable('parent', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  userId: text('user_id'),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  cpf: text('cpf'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const studentParent = pgTable(
  'student_parent',
  {
    studentId: uuid('student_id').notNull(),
    parentId: uuid('parent_id').notNull(),
    relationship: text('relationship').notNull(),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.parentId] })],
)

export const teacher = pgTable('teacher', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  userId: text('user_id'),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const subject = pgTable('subject', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  name: text('name').notNull(),
  code: text('code'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const schoolClass = pgTable('class', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  academicYearId: uuid('academic_year_id').notNull(),
  name: text('name').notNull(),
  grade: text('grade').notNull(),
  shift: text('shift').notNull().default('MORNING'),
  homeroomTeacherId: uuid('homeroom_teacher_id'),
  capacity: integer('capacity'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const classSubject = pgTable('class_subject', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  classId: uuid('class_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  teacherId: uuid('teacher_id'),
  workloadHours: integer('workload_hours'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const teacherSubject = pgTable(
  'teacher_subject',
  {
    teacherId: uuid('teacher_id').notNull(),
    subjectId: uuid('subject_id').notNull(),
    schoolId: uuid('school_id').notNull(),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.subjectId] })],
)

export const studentDocument = pgTable('student_document', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  studentId: uuid('student_id').notNull(),
  kind: text('kind').notNull(),
  label: text('label').notNull(),
  pathname: text('pathname').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  uploadedBy: text('uploaded_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const enrollment = pgTable('enrollment', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  studentId: uuid('student_id').notNull(),
  academicYearId: uuid('academic_year_id').notNull(),
  classId: uuid('class_id'),
  grade: text('grade').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  enrolledOn: date('enrolled_on').notNull().defaultNow(),
  statusChangedOn: date('status_changed_on'),
  statusNote: text('status_note'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
})

const score = (name: string) => numeric(name, { precision: 5, scale: 2, mode: 'number' })

export const assessment = pgTable('assessment', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  classSubjectId: uuid('class_subject_id').notNull(),
  classId: uuid('class_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  teacherId: uuid('teacher_id'),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  term: integer('term').notNull().default(1),
  heldOn: date('held_on').notNull(),
  weight: score('weight').notNull().default(1),
  maxScore: score('max_score').notNull().default(10),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const assessmentScore = pgTable('assessment_score', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  assessmentId: uuid('assessment_id').notNull(),
  studentId: uuid('student_id').notNull(),
  enrollmentId: uuid('enrollment_id').notNull(),
  score: score('score'),
  note: text('note'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
})

export const scoreChange = pgTable('score_change', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  scoreId: uuid('score_id').notNull(),
  oldScore: score('old_score'),
  newScore: score('new_score'),
  reason: text('reason').notNull(),
  changedBy: text('changed_by').notNull(),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const attendanceSession = pgTable('attendance_session', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  classSubjectId: uuid('class_subject_id').notNull(),
  classId: uuid('class_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
  teacherId: uuid('teacher_id'),
  heldOn: date('held_on').notNull(),
  lessons: integer('lessons').notNull().default(1),
  term: integer('term').notNull().default(1),
  content: text('content'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
})

export const attendanceRecord = pgTable('attendance_record', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  studentId: uuid('student_id').notNull(),
  enrollmentId: uuid('enrollment_id').notNull(),
  status: text('status').notNull(),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
})

export const attendanceChange = pgTable('attendance_change', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  recordId: uuid('record_id').notNull(),
  oldStatus: text('old_status').notNull(),
  newStatus: text('new_status').notNull(),
  reason: text('reason').notNull(),
  changedBy: text('changed_by').notNull(),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

/* ---------- Biblioteca ---------- */

export const book = pgTable('book', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  title: text('title').notNull(),
  authors: text('authors').notNull(),
  isbn: text('isbn'),
  publisher: text('publisher'),
  category: text('category'),
  publishedYear: integer('published_year'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const bookCopy = pgTable('book_copy', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  bookId: uuid('book_id').notNull(),
  code: text('code').notNull(),
  condition: text('condition').notNull().default('GOOD'),
  status: text('status').notNull().default('AVAILABLE'),
  notes: text('notes'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const bookLoan = pgTable('book_loan', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  copyId: uuid('copy_id').notNull(),
  bookId: uuid('book_id').notNull(),
  borrowerType: text('borrower_type').notNull(),
  studentId: uuid('student_id'),
  teacherId: uuid('teacher_id'),
  loanedOn: date('loaned_on').notNull(),
  dueOn: date('due_on').notNull(),
  returnedOn: date('returned_on'),
  status: text('status').notNull().default('ACTIVE'),
  renewals: integer('renewals').notNull().default(0),
  lateDays: integer('late_days').notNull().default(0),
  fineAmount: numeric('fine_amount', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  fineStatus: text('fine_status').notNull().default('NONE'),
  returnCondition: text('return_condition'),
  notes: text('notes'),
  dueAlertSentAt: timestamp('due_alert_sent_at', tz),
  overdueAlertSentAt: timestamp('overdue_alert_sent_at', tz),
  createdBy: text('created_by'),
  closedBy: text('closed_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
})

export const bookLoanEvent = pgTable('book_loan_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  loanId: uuid('loan_id').notNull(),
  kind: text('kind').notNull(),
  oldDueOn: date('old_due_on'),
  newDueOn: date('new_due_on'),
  reason: text('reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  actorUserId: text('actor_user_id'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id'),
  actorUserId: text('actor_user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const occurrenceType = pgTable('occurrence_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  name: text('name').notNull(),
  isPositive: boolean('is_positive').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const occurrence = pgTable('occurrence', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  studentId: uuid('student_id').notNull(),
  classId: uuid('class_id'),
  enrollmentId: uuid('enrollment_id'),
  academicYearId: uuid('academic_year_id'),
  typeId: uuid('type_id').notNull(),
  recordedByUserId: text('recorded_by_user_id').notNull(),
  teacherId: uuid('teacher_id'),
  occurredOn: date('occurred_on').notNull(),
  occurredAt: timestamp('occurred_at', tz).notNull(),
  term: integer('term').notNull().default(1),
  severity: text('severity').notNull(),
  description: text('description').notNull(),
  measures: jsonb('measures').$type<string[]>().notNull().default([]),
  measuresNote: text('measures_note'),
  status: text('status').notNull().default('PENDING'),
  visibleToFamily: boolean('visible_to_family').notNull().default(true),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
})

export const occurrenceChange = pgTable('occurrence_change', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  occurrenceId: uuid('occurrence_id').notNull(),
  action: text('action').notNull(),
  reason: text('reason').notNull(),
  changedBy: text('changed_by').notNull(),
  oldValues: jsonb('old_values').$type<Record<string, unknown>>().notNull().default({}),
  newValues: jsonb('new_values').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const occurrenceAlertSent = pgTable(
  'occurrence_alert_sent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull(),
    studentId: uuid('student_id').notNull(),
    academicYearId: uuid('academic_year_id').notNull(),
    term: integer('term').notNull(),
    kind: text('kind').notNull().default('CRITICAL_COUNT'),
    countAtSend: integer('count_at_send').notNull(),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('occurrence_alert_sent_uniq').on(t.schoolId, t.studentId, t.academicYearId, t.term, t.kind)],
)

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  schoolId: uuid('school_id'),
  title: text('title').notNull(),
  body: text('body'),
  href: text('href'),
  readAt: timestamp('read_at', tz),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const schoolEnrollment = pgTable('school_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  studentId: uuid('student_id').notNull(),
  academicYearId: uuid('academic_year_id').notNull(),
  classId: uuid('class_id'),
  status: text('status').notNull().default('pending'),
  enrollmentType: text('enrollment_type').notNull().default('new'),
  contractAccepted: boolean('contract_accepted').notNull().default(false),
  contractAcceptedAt: timestamp('contract_accepted_at', tz),
  financialCleared: boolean('financial_cleared').notNull().default(false),
  documentsCleared: boolean('documents_cleared').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
})

export const academicHistory = pgTable('academic_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  studentId: uuid('student_id').notNull(),
  academicYearId: uuid('academic_year_id').notNull(),
  gradeLevel: text('grade_level').notNull(),
  result: text('result').notNull(),
  finalAverage: numeric('final_average', { precision: 5, scale: 2, mode: 'number' }),
  attendanceRate: numeric('attendance_rate', { precision: 5, scale: 2, mode: 'number' }),
  institutionName: text('institution_name'),
  notes: text('notes'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const communicationCategory = pgTable('communication_category', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
}, (t) => [uniqueIndex('communication_category_school_name_uq').on(t.schoolId, t.name)])

export const announcement = pgTable('announcement', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => communicationCategory.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  priority: text('priority').notNull().default('NORMAL'),
  publishAt: timestamp('publish_at', tz).notNull().defaultNow(),
  expiresAt: date('expires_at'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
}, (t) => [index('announcement_school_publish_idx').on(t.schoolId, t.publishAt)])

export const announcementAudience = pgTable('announcement_audience', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  announcementId: uuid('announcement_id').notNull().references(() => announcement.id, { onDelete: 'cascade' }),
  audienceType: text('audience_type').notNull(),
  classId: uuid('class_id'),
  academicYearId: uuid('academic_year_id'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
}, (t) => [index('announcement_audience_school_idx').on(t.schoolId, t.audienceType, t.classId, t.academicYearId)])

export const announcementRead = pgTable('announcement_read', {
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  announcementId: uuid('announcement_id').notNull().references(() => announcement.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at', tz).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.announcementId, t.userId] }), index('announcement_read_school_idx').on(t.schoolId, t.readAt)])

export const financeCategory = pgTable('finance_category', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
}, (t) => [uniqueIndex('finance_category_school_name_uq').on(t.schoolId, t.name)])

export const financeChargeType = pgTable('finance_charge_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => financeCategory.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultAmount: numeric('default_amount', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
}, (t) => [uniqueIndex('finance_charge_type_school_name_uq').on(t.schoolId, t.name)])

export const paymentPlan = pgTable('payment_plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  installments: integer('installments').notNull().default(1),
  dueDay: integer('due_day').notNull().default(10),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', tz),
}, (t) => [index('payment_plan_school_idx').on(t.schoolId)])

export const studentPaymentPlan = pgTable('student_payment_plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => student.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => paymentPlan.id, { onDelete: 'restrict' }),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on'),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
}, (t) => [index('student_payment_plan_school_student_idx').on(t.schoolId, t.studentId)])

export const financeInvoice = pgTable('finance_invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => student.id, { onDelete: 'restrict' }),
  planAssignmentId: uuid('plan_assignment_id').references(() => studentPaymentPlan.id, { onDelete: 'set null' }),
  reference: text('reference').notNull(),
  dueOn: date('due_on').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  status: text('status').notNull().default('OPEN'),
  description: text('description'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at', tz),
}, (t) => [index('finance_invoice_school_student_idx').on(t.schoolId, t.studentId), index('finance_invoice_school_status_idx').on(t.schoolId, t.status)])

export const financeCharge = pgTable('finance_charge', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => financeInvoice.id, { onDelete: 'cascade' }),
  chargeTypeId: uuid('charge_type_id').references(() => financeChargeType.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const paymentSettlement = pgTable('payment_settlement', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => financeInvoice.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  paidOn: date('paid_on').notNull(),
  method: text('method').notNull(),
  retroactiveJustification: text('retroactive_justification'),
  cancelledAt: timestamp('cancelled_at', tz),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
}, (t) => [index('payment_settlement_school_invoice_idx').on(t.schoolId, t.invoiceId)])

export const financeAudit = pgTable('finance_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => school.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  action: text('action').notNull(),
  justification: text('justification'),
  beforeData: jsonb('before_data').$type<Record<string, unknown>>(),
  afterData: jsonb('after_data').$type<Record<string, unknown>>(),
  actorUserId: text('actor_user_id'),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
}, (t) => [index('finance_audit_school_entity_idx').on(t.schoolId, t.entityType, t.entityId)])
