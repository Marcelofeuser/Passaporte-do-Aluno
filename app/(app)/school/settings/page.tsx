import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { updateSchoolSettings } from '@/app/actions/school-settings'
import { ActionForm } from '@/components/school/action-form'
import { AddressFields, BackLink, FileField } from '@/components/school/form-fields'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { requireSchoolPage } from '@/lib/school-page'
import { getSchoolProfile } from '@/lib/school-queries'
import { fileUrl } from '@/lib/storage'

export const metadata: Metadata = { title: 'Dados da escola' }

const LABELS = {
  name: 'Nome',
  legalName: 'Razão social',
  cnpj: 'CNPJ',
  inepCode: 'INEP',
  email: 'E-mail',
  website: 'Site',
  addressZip: 'CEP',
  addressState: 'UF',
  logo: 'Logotipo',
}

export default async function SchoolSettingsPage() {
  const { schoolId } = await requireSchoolPage('school:manage_settings')
  const s = await getSchoolProfile(schoolId)
  if (!s) redirect('/dashboard')

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle title="Dados da escola" description="Informações usadas em documentos, boletins e comunicados." />
      <Card>
        <CardHeader title="Identificação" />
        <ActionForm action={updateSchoolSettings} submitLabel="Salvar dados" resetOnSuccess={false} fieldLabels={LABELS} className="p-4">
          <div className="flex items-center gap-4">
            {s.logoPathname ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(s.logoPathname)} alt={`Logotipo de ${s.name}`} className="size-16 rounded-lg border border-border object-contain" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                Sem logo
              </div>
            )}
            <div className="flex-1">
              <FileField id="logo" name="logo" label="Logotipo" accept="image/png,image/jpeg,image/webp" hint="PNG, JPG ou WebP até 2 MB." />
            </div>
          </div>
          <Field label="Nome da escola" htmlFor="name">
            <Input id="name" name="name" required maxLength={160} defaultValue={s.name} />
          </Field>
          <Field label="Razão social" htmlFor="legalName">
            <Input id="legalName" name="legalName" maxLength={200} defaultValue={s.legalName ?? ''} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="CNPJ" htmlFor="cnpj">
              <Input id="cnpj" name="cnpj" inputMode="numeric" maxLength={18} defaultValue={s.cnpj ?? ''} />
            </Field>
            <Field label="Código INEP" htmlFor="inepCode">
              <Input id="inepCode" name="inepCode" inputMode="numeric" maxLength={8} defaultValue={s.inepCode ?? ''} />
            </Field>
            <Field label="Inscrição estadual" htmlFor="stateRegistration">
              <Input id="stateRegistration" name="stateRegistration" maxLength={30} defaultValue={s.stateRegistration ?? ''} />
            </Field>
          </div>
          <Field label="Diretor(a)" htmlFor="directorName">
            <Input id="directorName" name="directorName" maxLength={120} defaultValue={s.directorName ?? ''} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="E-mail" htmlFor="email">
              <Input id="email" name="email" type="email" maxLength={160} defaultValue={s.email ?? ''} />
            </Field>
            <Field label="Telefone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" maxLength={20} defaultValue={s.phone ?? ''} />
            </Field>
            <Field label="Site" htmlFor="website">
              <Input id="website" name="website" type="url" maxLength={200} placeholder="https://" defaultValue={s.website ?? ''} />
            </Field>
          </div>
          <AddressFields prefix="school" values={s} />
        </ActionForm>
      </Card>
    </>
  )
}
