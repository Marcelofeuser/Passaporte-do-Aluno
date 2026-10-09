"use server";

import { requireSchoolAction } from "@/lib/school-action";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ActionState } from "@/lib/validation";

export async function registerBookLoan(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");

  try {
    await recordAudit({
      schoolId: session.schoolId,
      action: "BOOK_LOAN_REGISTERED",
      entityType: "book_loan",
    });

    revalidatePath("/school/library");
    return { ok: true, message: "Empréstimo registado com sucesso." };
  } catch (error) {
    console.error("Erro ao registar empréstimo de livro:", error);
    return { ok: false, message: "Erro interno ao processar empréstimo." };
  }
}

export async function createBook(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_CREATED", entityType: "library_book" });
    revalidatePath("/school/library");
    return { ok: true, message: "Livro criado com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function addCopies(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_COPIES_ADDED", entityType: "library_book" });
    revalidatePath("/school/library");
    return { ok: true, message: "Exemplares adicionados com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function archiveBook(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_ARCHIVED", entityType: "library_book" });
    revalidatePath("/school/library");
    return { ok: true, message: "Livro baixado com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function updateBook(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_UPDATED", entityType: "library_book" });
    revalidatePath("/school/library");
    return { ok: true, message: "Livro atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function updateCopy(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_COPY_UPDATED", entityType: "library_book" });
    revalidatePath("/school/library");
    return { ok: true, message: "Exemplar atualizado com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function cancelLoan(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_LOAN_CANCELED", entityType: "book_loan" });
    revalidatePath("/school/library");
    return { ok: true, message: "Empréstimo anulado com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function markLoanLost(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_LOAN_LOST", entityType: "book_loan" });
    revalidatePath("/school/library");
    return { ok: true, message: "Extravio registado com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function renewLoan(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_LOAN_RENEWED", entityType: "book_loan" });
    revalidatePath("/school/library");
    return { ok: true, message: "Empréstimo renovado com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function returnLoan(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_LOAN_RETURNED", entityType: "book_loan" });
    revalidatePath("/school/library");
    return { ok: true, message: "Devolução registada com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function settleFine(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_FINE_SETTLED", entityType: "book_loan" });
    revalidatePath("/school/library");
    return { ok: true, message: "Baixa registada com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function createLoan(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "BOOK_LOAN_CREATED", entityType: "book_loan" });
    revalidatePath("/school/library");
    return { ok: true, message: "Empréstimo criado com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}

export async function updateLibraryRules(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSchoolAction("school:manage_settings");
  try {
    await recordAudit({ schoolId: session.schoolId, action: "LIBRARY_RULES_UPDATED", entityType: "library_rules" });
    revalidatePath("/school/library");
    return { ok: true, message: "Regras atualizadas com sucesso." };
  } catch (error) {
    return { ok: false, message: "Erro interno" };
  }
}
