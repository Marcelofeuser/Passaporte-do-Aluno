import { requireSchoolAction } from "@/lib/school-action";

export default async function ParentPortalPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portal dos Encarregados de Educação</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhamento em tempo real do progresso escolar, frequências, avisos e pagamentos dos educandos.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Portal da família ativo para a instituição com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
