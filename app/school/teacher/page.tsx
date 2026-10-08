import { requireSchoolAction } from "@/lib/school-action";

export default async function SchoolTeacherPage() {
  const session = await requireSchoolAction("school:manage_settings");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portal do Professor e Diário de Classe</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de sumários, planos de aula e registos pedagógicos diários.
        </p>
      </div>

      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Portal do professor ativo para a escola com ID: {session.schoolId}
        </p>
      </div>
    </div>
  );
}
