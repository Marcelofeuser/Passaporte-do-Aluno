import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolTransportPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transporte Escolar e Rotas</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de rotas de autocarro, motoristas, matrículas em transporte e acompanhamento de frotas.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de transporte escolar ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
