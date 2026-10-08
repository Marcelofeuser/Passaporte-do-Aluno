import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolSettingsPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Definições da Escola</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de parâmetros institucionais, ano letivo ativo, contactos oficiais e preferências da instituição.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de configurações ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
