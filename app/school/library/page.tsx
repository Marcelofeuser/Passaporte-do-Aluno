import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolLibraryPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Biblioteca e Gestão de Empréstimos</h1>
        <p className="text-sm text-muted-foreground">
          Controlo do acervo bibliográfico, gestão de exemplares, empréstimos a alunos e prazos de devolução.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de biblioteca ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
