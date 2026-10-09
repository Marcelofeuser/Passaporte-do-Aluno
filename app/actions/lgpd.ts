"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createLgpdRequest(requesterEmail: string, requestType: "EXPORT" | "ANONYMIZE") {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "LGPD_REQUEST_CREATED",
      entityType: "lgpd_request",
    });

    revalidatePath("/school/lgpd");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar solicitação LGPD:", error);
    return { success: false, error: "Erro interno ao processar pedido de privacidade." };
  }
}
