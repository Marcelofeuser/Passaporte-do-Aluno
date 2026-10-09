# Passaporte do Aluno

Plataforma de gestão escolar multiescola: secretaria, corpo docente, famílias e alunos no mesmo sistema, com isolamento estrito de dados por escola e auditoria das operações sensíveis.

## Stack

- Next.js 16 (App Router, Server Actions) e React 19
- Tailwind CSS 4
- Neon Postgres com Drizzle ORM
- Better Auth (e-mail e senha)
- Vercel Blob (documentos e logotipos, acesso privado)
- Vercel Cron (alertas da biblioteca e do calendário)

## Estado do projeto

Atualizado em 09/10/2026.

| Fase | Módulo | Situação |
| --- | --- | --- |
| 1 | Fundação: autenticação, perfis e permissões (RBAC), cadastro de escolas, auditoria | Concluída |
| 2 | Gestão escolar: alunos, responsáveis, documentos, turmas, professores, disciplinas, anos letivos | Concluída |
| 3 | Diário: situações de matrícula, carga horária, avaliações, notas com alteração justificada e médias | Concluída |
| 4 | Chamada por disciplina, frequência mínima de 75% (LDB) e painel dos responsáveis com notas e frequência | Concluída |
| 5 | Ocorrências disciplinares, acompanhamento e avisos à família | Concluída |
| 6 | Comunicação / mural de avisos | Pendente (o PR #10 só trouxe um arquivo de teste, já removido) |
| 7 | Não definida | Pendente |
| 8 | Biblioteca: acervo, exemplares, empréstimos, devoluções, painel da família e alertas | Concluída |
| 9 | Calendário escolar, dias letivos e agendamento de atendimentos | Concluída |
| 10 | Matrículas e rematrículas, contratos, situação documental e histórico escolar | Concluída |
| 11 | Chamada diária do aluno (frequência geral do dia) | Concluída |

### Perfis de acesso

- **Super admin**: cadastra escolas e vincula administradores.
- **Equipe da escola** (direção, secretaria, coordenação, professores, bibliotecário): acesso conforme as permissões do perfil, sempre limitado à própria escola.
- **Responsável**: vê boletim, frequência, ocorrências, biblioteca e agenda dos filhos vinculados.
- **Aluno**: vê o próprio boletim, frequência, biblioteca e agenda.

### Segurança

- Todas as consultas filtram pela escola da sessão. O acesso cruzado entre escolas foi testado e retorna 404.
- Alterar notas, chamadas e ocorrências exige justificativa e gera registro no histórico.
- Os downloads de documentos passam por `/api/files`, que confere a permissão antes de entregar o arquivo.

## Estrutura

```
app/
  (auth)/          login, cadastro e recuperação de senha
  (app)/admin/     gestão de escolas (super admin)
  (app)/school/    módulos da escola
  (app)/family/    painel de responsáveis e alunos
  (app)/audit/     trilha de auditoria
  actions/         Server Actions por módulo
  api/             auth, arquivos protegidos e rotinas de cron
components/        componentes de interface
lib/               regras de negócio, consultas, RBAC e esquema do banco (lib/db/schema.ts)
migrations/        scripts SQL das fases 8 a 11
```

## Pendências conhecidas

- Definir e implementar as fases 6 (mural de avisos) e 7.
- Unificar a chamada por disciplina (fase 4) e a chamada diária (fase 11) num único cálculo de frequência.
- Remover o diretório `src/`, que sobrou do template Vite inicial.

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

Variáveis de ambiente necessárias: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN` e `CRON_SECRET`.
