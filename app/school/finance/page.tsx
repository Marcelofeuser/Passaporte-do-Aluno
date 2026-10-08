import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolFinancePage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão Financeira e Propinas</h1>
        <p className="text-sm text-muted-foreground">
          Controlo centralizado de mensalidades, faturas emitidas e estados de pagamento.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo financeiro ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
