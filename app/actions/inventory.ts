"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createAssetItem(itemName: string, category: string, quantity: number, condition: string, location: string) {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "SCHOOL_ASSET_CREATED",
      entityType: "school_asset",
    });

    revalidatePath("/school/inventory");
    return { success: true };
  } catch (error) {
    console.error("Erro ao registar item de inventário:", error);
    return { success: false, error: "Erro interno ao processar inventário escolar." };
  }
}
