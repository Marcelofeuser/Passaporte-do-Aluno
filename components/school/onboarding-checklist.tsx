import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import type { OnboardingStep } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

export function OnboardingChecklist({ steps, description }: { steps: OnboardingStep[]; description: string }) {
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  const nextId = steps.find((s) => !s.done)?.id
  const percent = Math.round((doneCount / steps.length) * 100)

  return (
    <Card aria-labelledby="onboarding-title">
      <CardHeader
        title="Primeiros passos"
        description={description}
        action={
          <span className="shrink-0 font-mono text-sm font-bold" aria-hidden="true">
            {doneCount}/{steps.length}
          </span>
        }
      />
      <div className="px-4 pt-4">
        <div
          role="progressbar"
          aria-label="Progresso da configuração"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuetext={`${doneCount} de ${steps.length} etapas concluídas`}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ol className="flex flex-col gap-1 p-2">
        {steps.map((step, index) => {
          const isNext = step.id === nextId
          return (
            <li
              key={step.id}
              aria-current={isNext ? 'step' : undefined}
              className={cn('flex gap-3 rounded-lg p-3', isNext && 'bg-muted')}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold',
                  step.done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isNext
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground',
                )}
              >
                {step.done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                <span className="sr-only">{step.done ? 'Concluída' : 'Pendente'}</span>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className={cn('font-semibold', step.done && 'text-muted-foreground line-through')}>{step.title}</p>
                {!step.done ? (
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.why}</p>
                ) : null}
                {isNext ? (
                  <Link href={step.href} className={cn(buttonClasses('primary', 'sm'), 'mt-1 self-start')}>
                    {step.cta}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
