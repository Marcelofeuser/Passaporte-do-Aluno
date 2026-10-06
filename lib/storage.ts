import { del, put } from '@vercel/blob'
import { logger } from '@/lib/logger'

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export class UploadError extends Error {}

export function getUploadedFile(formData: FormData, field: string): File | null {
  const value = formData.get(field)
  return value instanceof File && value.size > 0 ? value : null
}

/**
 * Valida e envia um arquivo para o Blob privado sob `schools/<schoolId>/<folder>/`.
 * O prefixo da escola é o que a rota de download usa para autorizar o acesso.
 */
export async function storeSchoolFile(
  file: File,
  opts: { schoolId: string; folder: string; allowed: readonly string[]; maxBytes: number },
) {
  if (!opts.allowed.includes(file.type)) throw new UploadError('Formato de arquivo não permitido.')
  if (file.size > opts.maxBytes) {
    throw new UploadError(`Arquivo muito grande (máx. ${Math.round(opts.maxBytes / 1024 / 1024)} MB).`)
  }
  const pathname = `schools/${opts.schoolId}/${opts.folder}/${crypto.randomUUID()}.${EXT[file.type]}`
  const blob = await put(pathname, file, { access: 'private', contentType: file.type })
  return { pathname: blob.pathname, contentType: file.type, size: file.size }
}

export async function removeStoredFile(pathname: string | null | undefined) {
  if (!pathname) return
  try {
    await del(pathname)
  } catch (error) {
    logger.warn('storage.delete_failed', { pathname, error })
  }
}

export function fileUrl(pathname: string) {
  return `/api/files?pathname=${encodeURIComponent(pathname)}`
}
