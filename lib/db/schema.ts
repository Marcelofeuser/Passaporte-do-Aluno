import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
