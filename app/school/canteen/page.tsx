import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolCanteenPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Cantina e Consumo</h1>
        <p className="text-sm text-muted-foreground">
          Controlo de produtos da cantina, vendas e consumo dos alunos associado ao passaporte escolar.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de cantina ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
