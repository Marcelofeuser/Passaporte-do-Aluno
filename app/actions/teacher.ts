"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createLessonPlan(title: string, content: string, classDate: string) {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "LESSON_PLAN_CREATED",
      entityType: "lesson_plan",
    });

    revalidatePath("/school/teacher");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar sumário de aula:", error);
    return { success: false, error: "Erro interno ao processar plano de aula." };
  }
}
