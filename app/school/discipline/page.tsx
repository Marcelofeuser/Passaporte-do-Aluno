import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolDisciplinePage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ocorrências e Disciplina Escolar</h1>
        <p className="text-sm text-muted-foreground">
          Registo e acompanhamento de ocorrências disciplinares, elogios e medidas corretivas aplicadas.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de disciplina ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
