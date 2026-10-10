import 'server-only'
import { and, count, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicYear,
  assessment,
  attendanceSession,
  classSubject,
  enrollment,
  schoolClass,
  student,
  subject,
  teacher,
} from '@/lib/db/schema'
import { getTeacherIdForUser } from '@/lib/grade-queries'
import { can, type Role } from '@/lib/rbac'

export type OnboardingStep = {
  id: string
  title: string
  why: string
  href: string
  cta: string
  done: boolean
}

async function total(query: Promise<{ value: number }[]>) {
  const [row] = await query
  return row?.value ?? 0
}

async function schoolSetupSteps(schoolId: string): Promise<OnboardingStep[]> {
  const [currentYear] = await db
    .select({ id: academicYear.id })
    .from(academicYear)
    .where(and(eq(academicYear.schoolId, schoolId), eq(academicYear.isCurrent, true), isNull(academicYear.deletedAt)))
    .limit(1)

  const yearId = currentYear?.id ?? null
  const inCurrentYear = yearId ? eq(schoolClass.academicYearId, yearId) : undefined

  const [subjects, teachers, classes, gridItems, students, placed] = await Promise.all([
    total(
      db
        .select({ value: count() })
        .from(subject)
        .where(and(eq(subject.schoolId, schoolId), isNull(subject.deletedAt))),
    ),
    total(
      db
        .select({ value: count() })
        .from(teacher)
        .where(and(eq(teacher.schoolId, schoolId), isNull(teacher.deletedAt))),
    ),
    yearId
      ? total(
          db
            .select({ value: count() })
            .from(schoolClass)
            .where(and(eq(schoolClass.schoolId, schoolId), inCurrentYear, isNull(schoolClass.deletedAt))),
        )
      : 0,
    yearId
      ? total(
          db
            .select({ value: count() })
            .from(classSubject)
            .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
            .where(and(eq(classSubject.schoolId, schoolId), inCurrentYear, isNull(schoolClass.deletedAt))),
        )
      : 0,
    total(
      db
        .select({ value: count() })
        .from(student)
        .where(and(eq(student.schoolId, schoolId), isNull(student.deletedAt))),
    ),
    yearId
      ? total(
          db
            .select({ value: count() })
            .from(enrollment)
            .where(
              and(
                eq(enrollment.schoolId, schoolId),
                eq(enrollment.academicYearId, yearId),
                eq(enrollment.status, 'ACTIVE'),
                isNotNull(enrollment.classId),
              ),
            ),
        )
      : 0,
  ])

  return [
    {
      id: 'year',
      title: 'Abrir o ano letivo',
      why: 'Turmas, notas e frequência são sempre ligadas a um ano letivo vigente.',
      href: '/school/years',
      cta: 'Criar ano letivo',
      done: Boolean(yearId),
    },
    {
      id: 'subjects',
      title: 'Cadastrar as disciplinas',
      why: 'São elas que formam a grade de cada turma e o diário do professor.',
      href: '/school/subjects',
      cta: 'Cadastrar disciplinas',
      done: subjects > 0,
    },
    {
      id: 'teachers',
      title: 'Cadastrar os professores',
      why: 'Cada disciplina da turma precisa de um professor responsável pelo diário.',
      href: '/school/teachers',
      cta: 'Cadastrar professores',
      done: teachers > 0,
    },
    {
      id: 'classes',
      title: 'Criar as turmas',
      why: 'A turma reúne alunos, disciplinas e professores de uma série.',
      href: '/school/classes',
      cta: 'Criar turma',
      done: classes > 0,
    },
    {
      id: 'grid',
      title: 'Montar a grade das turmas',
      why: 'Adicione as disciplinas, o professor e a carga horária. A carga horária define o limite de faltas.',
      href: '/school/classes',
      cta: 'Montar grade',
      done: gridItems > 0,
    },
    {
      id: 'students',
      title: 'Cadastrar os alunos',
      why: 'Com o aluno cadastrado você vincula responsáveis e documentos.',
      href: '/school/students',
      cta: 'Cadastrar aluno',
      done: students > 0,
    },
    {
      id: 'placement',
      title: 'Matricular os alunos nas turmas',
      why: 'Só alunos matriculados aparecem na chamada e no diário de notas.',
      href: '/school/students',
      cta: 'Matricular alunos',
      done: placed > 0,
    },
  ]
}

async function teacherSteps(schoolId: string, userId: string, email: string): Promise<OnboardingStep[]> {
  const teacherId = await getTeacherIdForUser(schoolId, userId, email)

  const [assigned, sessions, assessments] = teacherId
    ? await Promise.all([
        total(
          db
            .select({ value: count() })
            .from(classSubject)
            .where(and(eq(classSubject.schoolId, schoolId), eq(classSubject.teacherId, teacherId))),
        ),
        total(
          db
            .select({ value: count() })
            .from(attendanceSession)
            .where(and(eq(attendanceSession.schoolId, schoolId), eq(attendanceSession.teacherId, teacherId))),
        ),
        total(
          db
            .select({ value: count() })
            .from(assessment)
            .where(
              and(eq(assessment.schoolId, schoolId), eq(assessment.teacherId, teacherId), isNull(assessment.deletedAt)),
            ),
        ),
      ])
    : [0, 0, 0]

  return [
    {
      id: 'assigned',
      title: 'Receber suas disciplinas',
      why: teacherId
        ? 'A coordenação atribui você às disciplinas das turmas. Sem isso o diário fica vazio.'
        : 'Seu usuário ainda não está ligado a um cadastro de professor. Peça à secretaria para usar o mesmo e-mail.',
      href: '/school/grades',
      cta: 'Ver meu diário',
      done: assigned > 0,
    },
    {
      id: 'attendance',
      title: 'Fazer a primeira chamada',
      why: 'Registre presenças, faltas e atrasos de cada aula. A frequência mínima exigida é de 75%.',
      href: '/school/attendance',
      cta: 'Fazer chamada',
      done: sessions > 0,
    },
    {
      id: 'assessment',
      title: 'Criar a primeira avaliação',
      why: 'Defina o valor máximo e lance as notas. A média é calculada automaticamente.',
      href: '/school/grades',
      cta: 'Criar avaliação',
      done: assessments > 0,
    },
  ]
}

export async function getOnboardingSteps(
  schoolId: string,
  role: Role,
  userId: string,
  email: string,
): Promise<OnboardingStep[] | null> {
  if (can(role, 'school:manage_academic')) return schoolSetupSteps(schoolId)
  if (role === 'TEACHER') return teacherSteps(schoolId, userId, email)
  return null
}
