"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createRoute(routeName: string, driverName: string, vehiclePlate: string, capacity: number) {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "SCHOOL_ROUTE_CREATED",
      entityType: "school_route",
    });

    revalidatePath("/school/transport");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar rota de transporte:", error);
    return { success: false, error: "Erro interno ao processar rota de transporte." };
  }
}
