import { Field, Input, Label } from '@/components/ui/field'
import { cn } from '@/lib/utils'

type Address = {
  addressZip?: string | null
  addressStreet?: string | null
  addressNumber?: string | null
  addressComplement?: string | null
  addressDistrict?: string | null
  addressCity?: string | null
  addressState?: string | null
}

export function AddressFields({ prefix, values = {} }: { prefix: string; values?: Address }) {
  const id = (name: string) => `${prefix}-${name}`
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-sm font-bold tracking-wide text-muted-foreground uppercase">Endereço</legend>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr_7rem]">
        <Field label="CEP" htmlFor={id('zip')}>
          <Input id={id('zip')} name="addressZip" inputMode="numeric" maxLength={9} defaultValue={values.addressZip ?? ''} />
        </Field>
        <Field label="Logradouro" htmlFor={id('street')}>
          <Input id={id('street')} name="addressStreet" maxLength={160} defaultValue={values.addressStreet ?? ''} />
        </Field>
        <Field label="Número" htmlFor={id('number')}>
          <Input id={id('number')} name="addressNumber" maxLength={20} defaultValue={values.addressNumber ?? ''} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Complemento" htmlFor={id('complement')}>
          <Input id={id('complement')} name="addressComplement" maxLength={80} defaultValue={values.addressComplement ?? ''} />
        </Field>
        <Field label="Bairro" htmlFor={id('district')}>
          <Input id={id('district')} name="addressDistrict" maxLength={80} defaultValue={values.addressDistrict ?? ''} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <Field label="Cidade" htmlFor={id('city')}>
          <Input id={id('city')} name="addressCity" maxLength={80} defaultValue={values.addressCity ?? ''} />
        </Field>
        <Field label="UF" htmlFor={id('state')}>
          <Input id={id('state')} name="addressState" maxLength={2} className="uppercase" defaultValue={values.addressState ?? ''} />
        </Field>
      </div>
    </fieldset>
  )
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  )
}

export function FileField({
  id,
  name,
  label,
  accept,
  hint,
  required,
}: {
  id: string
  name: string
  label: string
  accept: string
  hint?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="w-full rounded-lg border border-dashed border-input bg-card p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-semibold file:text-secondary-foreground"
      />
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function Checkbox({ id, name, label, defaultChecked }: { id: string; name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold">
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 accent-primary" />
      {label}
    </label>
  )
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-sm font-semibold text-primary hover:underline">
      {'← '}
      {children}
    </a>
  )
}
