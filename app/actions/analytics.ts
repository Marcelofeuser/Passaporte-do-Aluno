"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function logDashboardAccess() {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "EXECUTIVE_DASHBOARD_ACCESSED",
      entityType: "school_analytics",
    });

    revalidatePath("/school/analytics");
    return { success: true };
  } catch (error) {
    console.error("Erro ao registar acesso ao painel executivo:", error);
    return { success: false, error: "Erro interno ao processar analítica." };
  }
}
