import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolActivitiesPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atividades Extraescolares e Clubes</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de modalidades desportivas, culturais e científicas, com controlo de vagas e inscrições.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de atividades extraescolares ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
