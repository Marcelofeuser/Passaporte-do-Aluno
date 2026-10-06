import { Textarea } from '@/components/school/form-fields'
import { Field, Input } from '@/components/ui/field'

export const BOOK_FIELD_LABELS = {
  title: 'Título',
  authors: 'Autores',
  isbn: 'ISBN',
  publisher: 'Editora',
  category: 'Categoria',
  publishedYear: 'Ano',
  notes: 'Observações',
}

type BookValues = {
  title?: string
  authors?: string
  isbn?: string | null
  publisher?: string | null
  category?: string | null
  publishedYear?: number | null
  notes?: string | null
}

export function BookFields({ prefix, values = {} }: { prefix: string; values?: BookValues }) {
  const id = (n: string) => `${prefix}-${n}`
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor={id('title')}>
          <Input id={id('title')} name="title" required maxLength={200} defaultValue={values.title ?? ''} />
        </Field>
        <Field label="Autor(es)" htmlFor={id('authors')} hint="Separe vários autores por vírgula.">
          <Input id={id('authors')} name="authors" required maxLength={300} defaultValue={values.authors ?? ''} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_7rem]">
        <Field label="ISBN" htmlFor={id('isbn')}>
          <Input id={id('isbn')} name="isbn" maxLength={20} inputMode="numeric" defaultValue={values.isbn ?? ''} />
        </Field>
        <Field label="Editora" htmlFor={id('publisher')}>
          <Input id={id('publisher')} name="publisher" maxLength={120} defaultValue={values.publisher ?? ''} />
        </Field>
        <Field label="Categoria / gênero" htmlFor={id('category')}>
          <Input id={id('category')} name="category" maxLength={60} defaultValue={values.category ?? ''} />
        </Field>
        <Field label="Ano" htmlFor={id('publishedYear')}>
          <Input id={id('publishedYear')} name="publishedYear" type="number" min={1450} max={2100} defaultValue={values.publishedYear ?? ''} />
        </Field>
      </div>
      <Field label="Observações" htmlFor={id('notes')}>
        <Textarea id={id('notes')} name="notes" maxLength={1000} className="min-h-16" defaultValue={values.notes ?? ''} />
      </Field>
    </>
  )
}
