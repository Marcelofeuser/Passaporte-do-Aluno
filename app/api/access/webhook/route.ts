import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { and, desc, eq, gte, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accessDevice, notification, parent, student, studentAccessLog, studentCredential, studentParent } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

/**
 * Webhook da portaria (Fase 8). Única superfície pública do módulo:
 * autentica-se pela deviceKey (hash SHA-256), sem sessão de usuário.
 * Payload: { deviceKey, identifier, method?, type } — identifier = UID NFC ou facialProfileId.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { deviceKey?: unknown; identifier?: unknown; method?: unknown; type?: unknown }
      | null
    const deviceKey = typeof body?.deviceKey === 'string' ? body.deviceKey : ''
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : ''
    const method = body?.method === 'FACIAL' ? 'FACIAL' : 'NFC'
    const type = body?.type

    if (!deviceKey || !identifier || (type !== 'ENTRADA' && type !== 'SAIDA')) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    // 1. Autentica o dispositivo pela key hasheada.
    const deviceKeyHash = createHash('sha256').update(deviceKey).digest('hex')
    const [device] = await db
      .select({ id: accessDevice.id, schoolId: accessDevice.schoolId })
      .from(accessDevice)
      .where(and(eq(accessDevice.deviceKeyHash, deviceKeyHash), eq(accessDevice.isActive, true), isNull(accessDevice.deletedAt)))
      .limit(1)
    if (!device) {
      return NextResponse.json({ ok: false, error: 'Dispositivo não autorizado' }, { status: 401 })
    }
    await db.update(accessDevice).set({ lastSeenAt: new Date() }).where(eq(accessDevice.id, device.id))

    // 2. Resolve a credencial (facial por perfil externo; NFC por UID).
    const [credential] = await db
      .select({ studentId: studentCredential.studentId, schoolId: studentCredential.schoolId, isActive: studentCredential.isActive })
      .from(studentCredential)
      .where(
        method === 'FACIAL' ? eq(studentCredential.facialProfileId, identifier) : eq(studentCredential.nfcCardUid, identifier),
      )
      .limit(1)
    if (!credential || !credential.isActive) {
      return NextResponse.json({ ok: false, error: 'Credencial não encontrada' }, { status: 404 })
    }

    // 3. Isolamento multi-tenant: a credencial precisa pertencer à escola do dispositivo.
    if (credential.schoolId !== device.schoolId) {
      return NextResponse.json({ ok: false, error: 'Credencial não encontrada' }, { status: 404 })
    }

    // 4. Anti-duplicidade: mesmo aluno + mesmo tipo em <= 3 min é idempotente.
    const since = new Date(Date.now() - 3 * 60_000)
    const [recent] = await db
      .select({ id: studentAccessLog.id })
      .from(studentAccessLog)
      .where(
        and(
          eq(studentAccessLog.schoolId, device.schoolId),
          eq(studentAccessLog.studentId, credential.studentId),
          eq(studentAccessLog.type, type),
          gte(studentAccessLog.occurredAt, since),
        ),
      )
      .orderBy(desc(studentAccessLog.occurredAt))
      .limit(1)
    if (recent) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    // 5. Registra o acesso.
    const [studentRow] = await db
      .select({ fullName: student.fullName, socialName: student.socialName })
      .from(student)
      .where(and(eq(student.schoolId, device.schoolId), eq(student.id, credential.studentId)))
      .limit(1)
    const name = studentRow?.socialName || studentRow?.fullName || 'Aluno'
    await db.insert(studentAccessLog).values({
      schoolId: device.schoolId,
      studentId: credential.studentId,
      deviceId: device.id,
      method,
      type,
      metadata: { identifier },
    })

    // 6. Notifica os responsáveis vinculados.
    const guardians = await db
      .select({ userId: parent.userId })
      .from(studentParent)
      .innerJoin(parent, and(eq(parent.id, studentParent.parentId), eq(parent.schoolId, device.schoolId), isNull(parent.deletedAt)))
      .where(eq(studentParent.studentId, credential.studentId))
    const recipients = [...new Set(guardians.map((g) => g.userId).filter((v): v is string => Boolean(v)))]
    if (recipients.length) {
      await db.insert(notification).values(
        recipients.map((userId) => ({
          userId,
          schoolId: device.schoolId,
          title: type === 'ENTRADA' ? `Entrada registrada: ${name}` : `Saída registrada: ${name}`,
          body: `${type === 'ENTRADA' ? 'Chegada' : 'Saída'} pela portaria (${method === 'FACIAL' ? 'biometria facial' : 'carteirinha NFC'}).`,
          href: '/family/access',
        })),
      )
    }

    return NextResponse.json({ ok: true, student: name, type })
  } catch (error) {
    logger.error('access.webhook_failed', { error })
    return NextResponse.json({ ok: false, error: 'Erro interno do servidor' }, { status: 500 })
  }
}
