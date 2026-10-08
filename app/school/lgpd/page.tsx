import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolLgpdPage() {
  await requireSchoolAction('school:manage_settings');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conformidade LGPD e Privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de consentimentos, portabilidade de dados e atendimento a solicitações de titulares.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Painel de solicitações de privacidade em conformidade com a LGPD ativo.
        </p>
      </div>
    </div>
  );
}
