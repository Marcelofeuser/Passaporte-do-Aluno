'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ATTENDANCE_SHORT, ATTENDANCE_STATUS, type AttendanceStatus } from '@/lib/attendance'

type Row = { studentId: string; name: string; registrationCode: string | null; previous: AttendanceStatus | null }

const TONE: Record<AttendanceStatus, string> = {
  PRESENT: 'peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary',
  ABSENT: 'peer-checked:bg-destructive peer-checked:text-primary-foreground peer-checked:border-destructive',
  LATE: 'peer-checked:bg-accent peer-checked:text-accent-foreground peer-checked:border-accent-foreground/40',
  EARLY_LEAVE: 'peer-checked:bg-secondary peer-checked:text-secondary-foreground peer-checked:border-foreground/40',
}

const STATUSES = Object.keys(ATTENDANCE_STATUS) as AttendanceStatus[]

/** Lista de chamada: um grupo de opções por aluno; alteração de registro existente pede justificativa. */
export function AttendanceSheet({ rows }: { rows: Row[] }) {
  const [values, setValues] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(rows.map((r) => [r.studentId, r.previous ?? 'PRESENT'])),
  )

  const counts = STATUSES.map((s) => [s, Object.values(values).filter((v) => v === s).length] as const)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {counts.map(([s, n]) => `${ATTENDANCE_STATUS[s]}: ${n}`).join(' · ')}
        </p>
        <button
          type="button"
          onClick={() => setValues(Object.fromEntries(rows.map((r) => [r.studentId, 'PRESENT' as const])))}
          className="rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          Marcar todos presentes
        </button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.map((r) => {
          const current = values[r.studentId]
          const changed = r.previous !== null && r.previous !== current
          return (
            <li key={r.studentId} className="flex flex-col gap-2 px-3 py-2">
              <fieldset className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <legend className="sr-only">Situação de {r.name}</legend>
                <div className="flex min-w-0 flex-col" aria-hidden="true">
                  <span className="truncate font-medium">{r.name}</span>
                  {r.registrationCode ? (
                    <span className="text-xs text-muted-foreground">Matrícula {r.registrationCode}</span>
                  ) : null}
                </div>
                <div className="flex gap-1.5">
                  {STATUSES.map((s) => (
                    <label key={s} className="relative">
                      <input
                        type="radio"
                        name={`status_${r.studentId}`}
                        value={s}
                        checked={current === s}
                        onChange={() => setValues((v) => ({ ...v, [r.studentId]: s }))}
                        className="peer sr-only"
                        aria-label={`${ATTENDANCE_STATUS[s]} — ${r.name}`}
                      />
                      <span
                        title={ATTENDANCE_STATUS[s]}
                        className={cn(
                          'flex size-9 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-sm font-bold text-muted-foreground transition-colors hover:bg-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
                          TONE[s],
                        )}
                      >
                        {ATTENDANCE_SHORT[s]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {changed ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold">
                    Justificativa ({ATTENDANCE_STATUS[r.previous!]} → {ATTENDANCE_STATUS[current]})
                  </span>
                  <input
                    name={`reason_${r.studentId}`}
                    required
                    minLength={5}
                    maxLength={300}
                    placeholder="Ex.: atestado médico apresentado"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </label>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        P = presente · F = falta · A = atraso · S = saída antecipada. Atraso e saída antecipada contam como presença.
      </p>
    </div>
  )
}
