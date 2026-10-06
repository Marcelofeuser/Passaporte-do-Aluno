# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Fase 5 — Ocorrências e Disciplina Escolar

- **Novas tabelas Drizzle**: `occurrence_type`, `occurrence`, `occurrence_action`, `occurrence_audit` (todas com `school_id` para isolamento multi-tenant) e novo campo `school.occurrence_alert_threshold` (padrão `3`).
- **Permissões**:
  - Tipos e limite crítico: `school:manage_academic` (admin/coordenador)
  - Ocorrências e acompanhamentos: `school:manage_attendance` (equipe escolar autorizada)
  - Portal da família: `family:view` com filtro server-side por vínculo válido do responsável/aluno.
- **Rotas/telas**:
  - Escola: `/school/occurrences` (filtros, paginação, CRUD, justificativa obrigatória em edição/arquivamento, acompanhamentos).
  - Tipos/configuração: `/school/occurrences/types`.
  - Família: `/family/occurrences` (somente ocorrências `FAMILY`, leitura).
  - Ficha do aluno: resumo comportamental mensal/anual + histórico.
- **Alertas**:
  - Ocorrências `FAMILY` geram aviso para responsáveis vinculados.
  - Ao atingir limite crítico no bimestre corrente (fallback calendário bimestral), coordenação/admin recebe alerta interno.

## Fase 6 — Gestão Financeira Escolar

A migração `migrations/0006_finance.sql` cria categorias e tipos de cobrança, planos, atribuições, faturas, lançamentos, baixas e auditoria. Execute-a no Neon/Postgres após as migrações anteriores. Todas as tabelas possuem `school_id`; ações escolares filtram o tenant e o portal/API da família filtram apenas alunos vinculados ao usuário autenticado. A baixa com data retroativa e cancelamentos exigem justificativa e ficam auditados.

## Fase 7 — Comunicação escolar / mural de avisos

A migração `migrations/0007_communications.sql` adiciona categorias configuráveis, avisos, públicos por escola/turma/ano letivo e recibos de leitura, sempre isolados por `school_id`. Administradores e coordenadores possuem `school:manage_communications` e publicam em `/school/communications`; professores não publicam nesta fase para evitar alcance indevido. O portal `/family/communications` resolve o público no servidor usando somente a escola ativa e matrículas ativas dos dependentes, e permite marcar avisos como lidos. A API autenticada `/api/announcements` oferece o feed filtrado e o registro de leitura. Publicações e categorias ficam registradas na auditoria.
