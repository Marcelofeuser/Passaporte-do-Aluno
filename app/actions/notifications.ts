"use server";

import { db } from "@/lib/db";
import { notification } from "@/lib/db/schema";
import { requireSchoolAction } from "@/lib/school-action";

export async function sendSchoolNotification(userId: string, title: string, body: string, channel: "IN_APP" | "EMAIL" | "PUSH" = "IN_APP") {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await db.insert(notification).values({
      schoolId: session.schoolId,
      userId,
      title,
      body,
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    return { success: false, error: "Erro ao processar notificação." };
  }
}
