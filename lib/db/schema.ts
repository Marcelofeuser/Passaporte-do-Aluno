import {
  boolean,
  check,
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
import { sql } from 'drizzle-orm'

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

export const occurrenceType = pgTable(
  'occurrence_type',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => school.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', tz),
  },
  (t) => [
    uniqueIndex('occurrence_type_school_name_uq').on(t.schoolId, t.name),
    index('occurrence_type_school_active_idx').on(t.schoolId, t.active),
  ],
)

export const occurrence = pgTable(
  'occurrence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => school.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => student.id, { onDelete: 'restrict' }),
    classId: uuid('class_id').references(() => schoolClass.id, { onDelete: 'set null' }),
    reporterUserId: text('reporter_user_id'),
    occurrenceTypeId: uuid('occurrence_type_id')
      .notNull()
      .references(() => occurrenceType.id, { onDelete: 'restrict' }),
    occurredAt: timestamp('occurred_at', tz).notNull().defaultNow(),
    severity: text('severity').notNull().default('LEVE'),
    visibility: text('visibility').notNull().default('INTERNAL'),
    status: text('status').notNull().default('PENDENTE'),
    description: text('description').notNull(),
    archivedAt: timestamp('archived_at', tz),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', tz),
  },
  (t) => [
    index('occurrence_school_student_idx').on(t.schoolId, t.studentId),
    index('occurrence_school_occurred_idx').on(t.schoolId, t.occurredAt),
    index('occurrence_school_status_idx').on(t.schoolId, t.status),
    check(
      'occurrence_severity_check',
      sql`${t.severity} in ('LEVE', 'MODERADA', 'GRAVE')`,
    ),
    check(
      'occurrence_visibility_check',
      sql`${t.visibility} in ('INTERNAL', 'FAMILY')`,
    ),
    check(
      'occurrence_status_check',
      sql`${t.status} in ('PENDENTE', 'EM_ACOMPANHAMENTO', 'RESOLVIDA')`,
    ),
  ],
)

export const occurrenceAction = pgTable(
  'occurrence_action',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => school.id, { onDelete: 'cascade' }),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => occurrence.id, { onDelete: 'cascade' }),
    actionType: text('action_type').notNull(),
    description: text('description').notNull(),
    performedBy: text('performed_by'),
    performedAt: timestamp('performed_at', tz).notNull().defaultNow(),
    dueDate: date('due_date'),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  },
  (t) => [index('occurrence_action_occurrence_idx').on(t.schoolId, t.occurrenceId, t.performedAt)],
)

export const occurrenceAudit = pgTable(
  'occurrence_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => school.id, { onDelete: 'cascade' }),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => occurrence.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id'),
    action: text('action').notNull(),
    justification: text('justification').notNull(),
    beforeData: jsonb('before_data').$type<Record<string, unknown>>(),
    afterData: jsonb('after_data').$type<Record<string, unknown>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  },
  (t) => [index('occurrence_audit_occurrence_idx').on(t.schoolId, t.occurrenceId, t.createdAt)],
)

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

/* ---------- Gestão financeira escolar (isolada por escola) ---------- */
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
