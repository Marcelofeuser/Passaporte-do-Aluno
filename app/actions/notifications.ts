"use server";

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireSchoolAction } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function sendSchoolNotification(userId: string, title: string, message: string, channel: "IN_APP" | "EMAIL" | "PUSH" = "IN_APP") {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await db.insert(notifications).values({
      schoolId: session.schoolId,
      userId,
      title,
      message,
      channel,
      isRead: false,
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    return { success: false, error: "Erro ao processar notificação." };
  }
}
