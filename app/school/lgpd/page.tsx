import { requireSchoolAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { lgpd_requests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function SchoolLgpdPage() {
  const session = await requireSchoolAuth();
  const schoolId = session.schoolId;

  const requests = await db
    .select()
    .from(lgpd_requests)
    .where(eq(lgpd_requests.schoolId, schoolId))
    .orderBy(desc(lgpd_requests.createdAt))
    .limit(25);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conformidade LGPD e Privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de consentimentos, portabilidade de dados e atendimento a solicitações de titulares.
        </p>
      </div>

      <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/40 font-medium">
          Histórico de Solicitações de Titulares
        </div>
        <div className="divide-y">
          {requests.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Ainda não existem solicitações de privacidade registadas.
            </p>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="p-4 flex items-center justify-between text-sm">
                <div className="space-y-0.5">
                  <p className="font-medium">{req.requesterEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    Tipo: <span className="uppercase font-semibold">{req.requestType}</span> • Data: {new Date(req.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    req.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {req.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
