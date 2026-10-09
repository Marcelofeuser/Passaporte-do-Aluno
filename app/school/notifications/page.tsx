import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolNotificationsPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comunicados e Notificações Escolares</h1>
        <p className="text-sm text-muted-foreground">
          Gestão e envio de avisos, comunicados oficiais e alertas para a comunidade escolar.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de notificações ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
