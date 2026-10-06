import type { Metadata } from 'next'
import Link from 'next/link'
import { createBook } from '@/app/actions/library'
import { ActionForm } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { COPY_CONDITIONS } from '@/lib/library'
import { listBooks, listCategories } from '@/lib/library-queries'
import { requireSchoolPage } from '@/lib/school-page'
import { BookFields, BOOK_FIELD_LABELS } from '../book-fields'

export const metadata: Metadata = { title: 'Acervo' }

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { schoolId } = await requireSchoolPage('school:manage_library')
  const sp = await searchParams
  const q = sp.q?.trim().slice(0, 80) ?? ''
  const category = sp.category?.trim().slice(0, 60) ?? ''
  const [books, categories] = await Promise.all([listBooks(schoolId, { q, category }), listCategories(schoolId)])

  return (
    <>
      <BackLink href="/school/library">Biblioteca</BackLink>
      <PageTitle title="Acervo" description="Títulos, exemplares e disponibilidade para empréstimo." />

      <Card>
        <CardHeader title="Títulos" description={`${books.length} título(s)${q || category ? ' encontrados' : ''}.`} />
        <form className="flex flex-wrap gap-2 px-4 py-3" role="search">
          <Input name="q" defaultValue={q} placeholder="Título, autor ou ISBN" aria-label="Buscar no acervo" className="h-9 w-64" />
          <Select name="category" defaultValue={category} aria-label="Categoria" className="h-9 w-48">
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClasses('outline', 'sm')}>
            Filtrar
          </button>
        </form>
        {books.length === 0 ? (
          <EmptyState title="Nenhum título" description="Cadastre o primeiro título do acervo abaixo." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {books.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/school/library/books/${b.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{b.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {b.authors}
                      {b.category ? ` · ${b.category}` : ''}
                      {b.publishedYear ? ` · ${b.publishedYear}` : ''}
                      {b.isbn ? ` · ISBN ${b.isbn}` : ''}
                    </span>
                  </div>
                  <span
                    className={
                      b.available > 0
                        ? 'rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground'
                        : 'rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground'
                    }
                  >
                    {b.available} de {b.total} disponível(is)
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Cadastrar título" description="Os exemplares recebem códigos de tombo sequenciais automaticamente." />
        <ActionForm
          action={createBook}
          submitLabel="Cadastrar título"
          className="p-4"
          fieldLabels={{ ...BOOK_FIELD_LABELS, copies: 'Exemplares' }}
        >
          <BookFields prefix="new" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exemplares no acervo físico" htmlFor="new-copies">
              <Input id="new-copies" name="copies" type="number" min={0} max={200} required defaultValue={1} />
            </Field>
            <Field label="Estado de conservação" htmlFor="new-condition">
              <Select id="new-condition" name="condition" defaultValue="NEW">
                {Object.entries(COPY_CONDITIONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </ActionForm>
      </Card>
    </>
  )
}
