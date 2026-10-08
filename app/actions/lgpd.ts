"use server";

import { db } from "@/lib/db";
import { lgpd_requests } from "@/lib/db/schema";
import { requireSchoolAction } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createLgpdRequest(requesterEmail: string, requestType: "EXPORT" | "ANONYMIZE") {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    const [request] = await db
      .insert(lgpd_requests)
      .values({
        schoolId: session.schoolId,
        requesterEmail,
        requestType,
        status: "PENDING",
      })
      .returning();

    await recordAudit({
      schoolId: session.schoolId,
      userId: session.userId,
      action: "LGPD_REQUEST_CREATED",
      details: `Solicitação LGPD do tipo ${requestType} registada para ${requesterEmail}`,
    });

    revalidatePath("/school/lgpd");
    return { success: true, requestId: request.id };
  } catch (error) {
    console.error("Erro ao criar solicitação LGPD:", error);
    return { success: false, error: "Erro interno ao processar pedido de privacidade." };
  }
}
