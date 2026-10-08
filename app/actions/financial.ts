"use server";

import { db } from "@/lib/db";
import { school } from "@/lib/db/schema";
import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createTuitionInvoice(studentId: string, title: string, amount: number, dueDate: string) {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "TUITION_INVOICE_CREATED",
      entityType: "tuition_invoice",
    });

    revalidatePath("/school/finance");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar fatura:", error);
    return { success: false, error: "Erro interno ao processar fatura escolar." };
  }
}
