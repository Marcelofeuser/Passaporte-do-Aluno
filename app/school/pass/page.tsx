import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolDigitalPassPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Passaporte de Identidade Digital</h1>
        <p className="text-sm text-muted-foreground">
          Emissão de cartões de identificação escolar digitais com QR Code seguro e controlo de acessos.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Módulo de passaporte digital ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
