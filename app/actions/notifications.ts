"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ActionState } from "@/lib/validation";

export async function createAnnouncement(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "SCHOOL_ANNOUNCEMENT_CREATED",
      entityType: "school_announcement",
    });

    revalidatePath("/school/notifications");
    return { ok: true, message: "Comunicado criado com sucesso." };
  } catch (error) {
    console.error("Erro ao criar comunicado:", error);
    return { ok: false, message: "Erro interno ao processar comunicado." };
  }
}
