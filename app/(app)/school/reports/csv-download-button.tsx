'use client'

import { useActionState, useEffect } from 'react'
import { exportReportCsv, type ReportExportState } from '@/app/actions/reports'
import { Button } from '@/components/ui/button'
import { initialActionState } from '@/lib/validation'

type Props = {
  reportType: string
  yearId: string
  yearLabel: string
  label: string
}

/** Dispara a exportação CSV auditada e baixa o arquivo gerado pela action. */
export function CsvDownloadButton({ reportType, yearId, yearLabel, label }: Props) {
  const [state, formAction, pending] = useActionState<ReportExportState, FormData>(exportReportCsv, initialActionState)

  useEffect(() => {
    if (state.ok && state.csv && state.filename) {
      const blob = new Blob([state.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = state.filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [state])

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="reportType" value={reportType} />
      <input type="hidden" name="yearId" value={yearId} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Gerando…' : `${label} (${yearLabel})`}
      </Button>
      {!pending && !state.ok && state.message ? <p className="mt-1 text-xs text-destructive">{state.message}</p> : null}
    </form>
  )
}
