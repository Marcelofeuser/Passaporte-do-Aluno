# Passaporte do Aluno

Plataforma escolar para acompanhar a jornada do aluno, conectando escolas, equipes pedagógicas, estudantes e responsáveis.

## Áreas do produto

- **Escola:** estudantes, turmas, matrículas, frequência, notas, biblioteca, calendário, atendimentos, ocorrências, professores, disciplinas e anos letivos.
- **Família:** agenda, atendimentos e biblioteca.
- **Administração:** escolas e auditoria.

## Tecnologias

- Next.js 16 com App Router e React 19
- TypeScript e Tailwind CSS 4
- Better Auth para autenticação
- PostgreSQL com Drizzle ORM; schema em `lib/db/schema.ts` e migrações em `migrations/`
- Vercel Blob para arquivos privados

## Desenvolvimento local

Requer Node.js compatível com Next.js 16 e pnpm.

```bash
pnpm install
pnpm dev
```

Configure as variáveis de ambiente necessárias antes de iniciar. A aplicação usa `DATABASE_URL` para conectar ao PostgreSQL; `CRON_SECRET` protege os endpoints de alertas do calendário e da biblioteca. A autenticação e o armazenamento de arquivos também dependem da configuração do ambiente do projeto.

## Verificações

```bash
pnpm typecheck
pnpm build
```
