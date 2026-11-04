import { get } from '@vercel/blob'
import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { student, studentDocument, studentPassport } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { can } from '@/lib/rbac'
import { getAppContext, roleInSchool } from '@/lib/session'

const PATH_RE = /^schools\/([0-9a-f-]{36})\/(branding|students)\/[\w/.-]+$/i

/**
 * Entrega arquivos privados do Blob. A escola é extraída do prefixo do caminho e o usuário
 * precisa ter vínculo ativo com ela. Fotos e documentos de alunos exigem permissão de secretaria.
 */
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get('pathname') ?? ''
  const match = PATH_RE.exec(pathname)
  if (!match || pathname.includes('..')) return new NextResponse('Not found', { status: 404 })
  const [, schoolId, area] = match

  const ctx = await getAppContext()
  if (!ctx) return new NextResponse('Unauthorized', { status: 401 })

  if (area === 'branding') {
    if (!roleInSchool(ctx, schoolId)) return new NextResponse('Forbidden', { status: 403 })
  } else {
    const sourceAllowed = can(roleInSchool(ctx, schoolId), 'school:view_students')
    const [document] = await db
      .select({ currentSchoolId: studentPassport.currentSchoolId })
      .from(studentDocument)
      .innerJoin(student, and(eq(student.id, studentDocument.studentId), eq(student.schoolId, studentDocument.schoolId)))
      .leftJoin(studentPassport, eq(studentPassport.id, student.passportId))
      .where(
        and(
          eq(studentDocument.pathname, pathname),
          eq(studentDocument.schoolId, schoolId),
          isNull(studentDocument.deletedAt),
        ),
      )
      .limit(1)

    const [photo] = document
      ? []
      : await db
          .select({ currentSchoolId: studentPassport.currentSchoolId })
          .from(student)
          .leftJoin(studentPassport, eq(studentPassport.id, student.passportId))
          .where(and(eq(student.photoPathname, pathname), eq(student.schoolId, schoolId)))
          .limit(1)

    const ownerSchoolId = document?.currentSchoolId ?? photo?.currentSchoolId
    const ownerAllowed = Boolean(ownerSchoolId && can(roleInSchool(ctx, ownerSchoolId), 'school:view_students'))
    if (!sourceAllowed && !ownerAllowed) return new NextResponse('Forbidden', { status: 403 })
    if (!document && !photo) return new NextResponse('Not found', { status: 404 })
  }

  try {
    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })
    if (!result) return new NextResponse('Not found', { status: 404 })
    const cacheHeaders = { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' }
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: cacheHeaders })
    return new NextResponse(result.stream, {
      headers: {
        ...cacheHeaders,
        'Content-Type': result.blob.contentType,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    logger.error('files.serve_failed', { error })
    return new NextResponse('Erro ao carregar arquivo', { status: 500 })
  }
}
