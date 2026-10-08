'use server'

import { verifyDocumentByCode } from '@/lib/documents'

/** Action pública da rota aberta /verify/document: leitura por código, sem mutação e sem expor o db ao client. */
export async function verifyDocumentCodeAction(code: string) {
  return verifyDocumentByCode(code)
}
