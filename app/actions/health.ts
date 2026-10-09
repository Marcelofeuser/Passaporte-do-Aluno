"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function recordClinicVisit(studentId: string, symptoms: string, treatmentGiven: string, nurseNotes: string) {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "STUDENT_HEALTH_VISIT_RECORDED",
      entityType: "student_health_visit",
    });

    revalidatePath("/school/health");
    return { success: true };
  } catch (error) {
    console.error("Erro ao registar atendimento na enfermaria:", error);
    return { success: false, error: "Erro interno ao processar registo de saúde." };
  }
}
