"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function linkStudentToGuardian(guardianName: string, guardianEmail: string, relationship: string, phone: string) {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "GUARDIAN_LINKED_TO_STUDENT",
      entityType: "student_guardian",
    });

    revalidatePath("/portal");
    return { success: true };
  } catch (error) {
    console.error("Erro ao associar encarregado de educação:", error);
    return { success: false, error: "Erro interno ao processar portal da família." };
  }
}
