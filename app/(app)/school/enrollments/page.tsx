import { db } from "@/lib/db";
import { schoolEnrollment, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";

interface PageProps {
    searchParams: Promise<{ schoolId?: string }>;
}

export default async function SchoolEnrollmentsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const schoolId = params.schoolId;

    // Busca as matrículas associadas à escola com base no schema existente
    const enrollments = schoolId
        ? await db
            .select({
                id: schoolEnrollment.id,
                status: schoolEnrollment.status,
                enrollmentType: schoolEnrollment.enrollmentType,
                contractAccepted: schoolEnrollment.contractAccepted,
                financialCleared: schoolEnrollment.financialCleared,
                documentsCleared: schoolEnrollment.documentsCleared,
                createdAt: schoolEnrollment.createdAt,
                studentName: user.name,
            })
            .from(schoolEnrollment)
            .leftJoin(user, eq(schoolEnrollment.studentId, user.id))
            .where(eq(schoolEnrollment.schoolId, schoolId))
        : [];

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Gestão de Matrículas</h1>
                <p className="text-muted-foreground">
                    Acompanhe ingressos, rematrículas, status financeiro e documentação dos alunos.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card title="Total de Matrículas">
                    <div className="text-2xl font-bold pt-2">{enrollments.length}</div>
                </Card>
            </div>

            <Card title="Lista de Alunos Matriculados / Solicitantes">
                <div className="pt-2">
                    {!schoolId ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            Selecione uma escola para visualizar as matrículas.
                        </p>
                    ) : enrollments.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            Nenhuma matrícula registada para esta escola.
                        </p>
                    ) : (
                        <div className="divide-y">
                            {enrollments.map((item) => (
                                <div key={item.id} className="py-3 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{item.studentName || "Aluno não identificado"}</p>
                                        <p className="text-xs text-muted-foreground capitalize">
                                            Tipo: {item.enrollmentType} • Criado em: {new Date(item.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
                                            {item.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}