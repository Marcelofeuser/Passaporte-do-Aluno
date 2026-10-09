import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolHealthPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enfermaria e Saúde Escolar</h1>
        <p className="text-sm text-muted-foreground">
          Registo de atendimentos médicos, ocorrências na enfermaria, alergias e administração de medicamentos.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de enfermaria e saúde ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
