# Proteção do histórico escolar após transferência

## Regra de acesso

Cada cadastro existente recebe seu próprio passaporte. A migração não tenta unir alunos por nome, CPF ou outros dados pessoais.

Quando uma transferência é aceita:

- a matrícula ativa na escola de origem é encerrada como transferida;
- a escola de destino passa a ser a responsável atual do passaporte;
- as ações do aplicativo impedem alterações feitas por escola anterior;
- os gatilhos do PostgreSQL também bloqueiam gravações antigas em cadastros, matrículas, documentos, notas, frequência, ocorrências e registros acadêmicos;
- documentos e lançamentos continuam vinculados à escola que os produziu, para consulta e auditoria;
- os registros de mudanças são somente de acréscimo e não podem ser editados ou apagados.

A confirmação de uma transferência é a única operação que muda a escola responsável. O banco exige uma solicitação pendente entre as duas instituições e o cadastro local de destino.

## Correção de lançamento histórico

O responsável pelo aluno deve procurar a instituição que fez o lançamento. A instituição de origem abre o chamado com o suporte pelo endereço **suporte@passaportedoaluno.com**.

A solicitação deve informar o registro original, a alteração solicitada, o motivo e as provas do erro. Deve incluir uma declaração assinada pelo diretor atual da instituição que realizou o lançamento, com assinatura autenticada pelo GOV.br.

A correção não substitui nem apaga o dado original. Após a análise do suporte, ela deve ser registrada como um adendo auditável, preservando o valor original e a decisão tomada.

## Autenticação e provisionamento

O cadastro público está desabilitado. A instituição cria contas pela área administrativa, e nenhum novo usuário recebe o perfil Super Admin automaticamente. Em uma instalação nova, um operador autorizado deve provisionar a primeira conta Super Admin por um procedimento administrativo controlado, usando o fluxo de credenciais do Better Auth; não reative o cadastro público nem a promoção automática para iniciar o sistema.

Antes de habilitar a versão em produção, revise todas as associações existentes com o perfil `SUPER_ADMIN` e confirme que cada uma é autorizada. Desabilitar o cadastro público impede novas promoções automáticas, mas não revoga perfis já gravados.

O envio de redefinição de senha ainda depende da integração de e-mail. Em produção, a solicitação é registrada, mas o sistema não envia o link enquanto um provedor de e-mail não estiver configurado.

## Implantação

A migração `0013_student_history_immutability.sql` precisa ser aplicada no PostgreSQL depois da `0012_student_passport.sql` e antes de considerar a proteção ativa em produção. O merge do código não executa essa migração automaticamente.
