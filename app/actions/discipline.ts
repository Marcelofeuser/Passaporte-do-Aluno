"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ActionState } from "@/lib/validation";

export async function recordIncident(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "SCHOOL_INCIDENT_RECORDED",
      entityType: "school_incident",
    });

    revalidatePath("/school/discipline");
    return { ok: true, message: "Ocorrência registada com sucesso." };
  } catch (error) {
    console.error("Erro ao registar ocorrência:", error);
    return { ok: false, message: "Erro interno ao processar ocorrência." };
  }
}
