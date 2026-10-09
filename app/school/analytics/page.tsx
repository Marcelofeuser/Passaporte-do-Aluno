import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolAnalyticsPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel Executivo e Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores de desempenho escolar, métricas de frequência, financeiras e operacionais em tempo real.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Painel analítico ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
