import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolInventoryPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventário e Património Escolar</h1>
        <p className="text-sm text-muted-foreground">
          Controlo centralizado de equipamentos, mobiliário, material didático e estado de conservação dos ativos.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de inventário ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
