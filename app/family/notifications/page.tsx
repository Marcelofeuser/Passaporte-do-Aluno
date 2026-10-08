import { requireSchoolAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function FamilyNotificationsPage() {
  const session = await requireSchoolAuth();

  const userNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(30);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notificações e Avisos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe os comunicados da escola, avisos de portaria e atualizações académicas em tempo real.
        </p>
      </div>

      <div className="border rounded-lg bg-card shadow-sm overflow-hidden divide-y">
        {userNotifications.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Não tem nenhuma notificação recente.
          </p>
        ) : (
          userNotifications.map((n) => (
            <div key={n.id} className="p-4 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">{n.title}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="text-muted-foreground">{n.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
