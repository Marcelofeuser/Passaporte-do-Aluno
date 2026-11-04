import type { Metadata } from 'next'
import { acceptStudentTransfer, rejectStudentTransfer } from '@/app/actions/student-transfers'
import { IncomingTransfers } from '@/components/school/student-passport'
import { BackLink } from '@/components/school/form-fields'
import { PageTitle } from '@/components/ui/card'
import { getIncomingStudentTransfers } from '@/lib/student-passport-queries'
import { formatDate, requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Transferências escolares' }

export default async function SchoolTransfersPage() {
  const { schoolId } = await requireSchoolPage('school:view_students')
  const transfers = await getIncomingStudentTransfers(schoolId)

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/school">Escola</BackLink>
      <PageTitle
        title="Transferências escolares"
        description="Revise as solicitações recebidas. A escola atual só muda após a confirmação."
      />
      <IncomingTransfers
        transfers={transfers.map((transfer) => ({ ...transfer, requestedAtLabel: formatDate(transfer.requestedAt) }))}
        acceptAction={acceptStudentTransfer}
        rejectAction={rejectStudentTransfer}
      />
    </div>
  )
}
