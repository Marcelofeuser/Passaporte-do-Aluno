"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ActionState } from "@/lib/validation";

export async function createCanteenProduct(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "CANTEEN_PRODUCT_CREATED",
      entityType: "canteen_product",
    });

    revalidatePath("/school/canteen");
    return { ok: true, message: "Produto criado com sucesso." };
  } catch (error) {
    console.error("Erro ao criar produto na cantina:", error);
    return { ok: false, message: "Erro interno ao processar produto." };
  }
}

export async function recordCanteenPurchase(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "CANTEEN_PURCHASE_RECORDED",
      entityType: "canteen_purchase",
    });

    revalidatePath("/school/canteen");
    return { ok: true, message: "Compra registada com sucesso." };
  } catch (error) {
    console.error("Erro ao registar compra na cantina:", error);
    return { ok: false, message: "Erro interno ao processar compra." };
  }
}
