"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createActivity(title: string, description: string, instructor: string, maxCapacity: number, schedule: string) {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "EXTRACURRICULAR_ACTIVITY_CREATED",
      entityType: "extracurricular_activity",
    });

    revalidatePath("/school/activities");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar atividade extraescolar:", error);
    return { success: false, error: "Erro interno ao processar atividade." };
  }
}
