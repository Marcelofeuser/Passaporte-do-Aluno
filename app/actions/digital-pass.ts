"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ActionState } from "@/lib/validation";

export async function generateStudentPass(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "DIGITAL_PASS_GENERATED",
      entityType: "student_digital_pass",
    });

    revalidatePath("/school/pass");
    return { ok: true, message: "Passaporte digital gerado com sucesso." };
  } catch (error) {
    console.error("Erro ao gerar passaporte digital:", error);
    return { ok: false, message: "Erro interno ao processar passaporte." };
  }
}
