"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function updateSchoolSettings(academicYear: string, contactEmail: string, phone: string, address: string) {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "SCHOOL_SETTINGS_UPDATED",
      entityType: "school_setting",
    });

    revalidatePath("/school/settings");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar definições da escola:", error);
    return { success: false, error: "Erro interno ao processar definições." };
  }
}
