# Chat LOSI — número, pagamentos e primeiras conversas

## Entrega

Número opcional em Minha Empresa: 10.000 créditos/R$29,90 ou 50.000/R$79,90. Recargas têm os mesmos preços e mantêm o número. Pagamento via checkout Asaas existente, com externalReference `losi_chat:<order UUID>`. Confirmação por webhook ou consulta autenticada ao Asaas; valores, cliente e ID do pagamento conferidos antes de creditar. Notificação + crédito + alteração do pedido são uma transação. Número de nove dígitos exclusivo gerado no servidor somente no resgate de uma compra inicial paga. Publicação do número no perfil é opt-in.

Texto privado custa 1 crédito; destinatário recebe gratuitamente. Busca pelo número interno, favoritos, não lidas, histórico paginado de 100 mensagens e saldo real. Atualizações por consulta enquanto a página está visível: mensagens 5s, lista 10s, carteira 15s e após as próprias ações. Não promete entrega instantânea nem criptografia de ponta a ponta. Imagens e documentos estão habilitados em conversas privadas e grupos. Áudio e vídeo ficam para etapa posterior.

## Acesso e consistência

- `losi-chat` valida Bearer por `auth.getUser`; usuário efetivo sempre obtido da autenticação.
- Ação pública `public-number` retorna somente o número de uma empresa ativa/aprovada cujo proprietário escolheu publicá-lo. Carteira, pedidos e dados pessoais não são retornados nessa ação.
- Todas as tabelas novas têm RLS. Escritas e RPCs de pagamento/envio acessíveis somente ao serviço do servidor. Usuário autenticado lê apenas carteira/pedidos próprios e conversas das quais participa.
- Reserva bloqueia pedidos concorrentes por proprietário e mantém apenas um pedido pendente. Timeout de POST ao Asaas mantém pedido reservado; novas tentativas consultam a cobrança pela referência, sem recriar o pagamento. Se a consulta não localizar a cobrança, a interface mantém verificação pendente para evitar duplicidade; reconciliação administrativa pode ser necessária.
- Envio trava carteira e grava mensagem/débito/registro em uma transação; UUID do envio torna retry idempotente. Zero créditos impede novos textos. Mensagens já recebidas continuam acessíveis.
- Estorno/chargeback reverte os créditos do pedido uma única vez, preservando número. Se os créditos já foram usados, saldo pode ficar negativo internamente; saldo disponível exibido como zero e novas recargas compensam esse valor antes de liberar envios.
- Leitura avança monotonamente até a mensagem consultada. Favoritos independentes da leitura. Histórico usa timestamp e UUID como cursor, preservando precisão do Postgres.
- Webhook Asaas recebeu somente um ramo para referências `losi_chat:`. Fluxos ADS e assinaturas existentes preservados. A criação de cliente não modifica campos protegidos do cadastro da empresa.

## Validação

`node tests/losi-chat-edge.cjs`: autenticação, preço fixo no servidor, cobrança única, timeout de resultado incerto, rejeição, valor divergente, limite do texto, privacidade pública e preservação do webhook anterior.

`tests/losi-chat-database.sql`: executado em transação com rollback. Reserva, valor, resgate antes/depois de pagar, recebimento duplicado, número estável, débito e envio duplicado, destinatário gratuito, saldo zero, estorno repetido, favoritos/leitura e RLS. Não cria cobranças nem altera saldo real de fornecedores.

Build de produção local validada. TypeScript do projeto ainda tem erros anteriores fora do Chat LOSI; nenhum erro dos arquivos novos. Não foi feito pagamento real de cliente nem teste visual de navegador nesta etapa.


## Grupos e cancelamento de faturas

Criação no menu Novo grupo ou Contatos; filtro Grupos mostra grupos reais. Até 100 participantes, adicionados por número digital LOSI. Nome até 80 caracteres e descrição até 500. Quem cria administra: adiciona/remove, altera dados, transfere administração. Participante pode sair; administrador transfere antes de sair. Novas consultas de mensagens/dados são rejeitadas após remoção/saída; mensagens previamente recebidas pelo navegador não podem ser revogadas retroativamente. Cada entrada/reentrada define início do histórico acessível. Metadados mostram apenas nome profissional, foto, número digital e papel; nenhuma carteira, CPF, telefone ou WhatsApp pessoal de outros usuários.

Mensagens de grupo e débito são atômicos, com 1 crédito por envio, independente de destinatários. Retry com UUID igual não duplica. Gravação do envio e alterações de membros travam o grupo para coordenar remoções. Histórico paginado, nomes dos remetentes, favoritos e não lidas funcionam como no privado. Alteração de destino ao reutilizar UUID é rejeitada no privado e no grupo.

Cancelar fatura tem confirmação junto à cobrança em Minha Empresa e nas áreas Créditos/Você. Servidor busca exclusivamente pedido do usuário autenticado, consulta/reconcilia o Asaas e permite DELETE apenas quando pendente/vencida. Só marca cancelado após resposta de exclusão confirmada. Pedido pago é creditado/reconciliado e não cancelado. Resultado incerto preserva o pedido; retry consulta estado, sem fabricar cancelamento ou nova cobrança. Não existe reembolso pelo botão de cancelamento.

Verificação adicional: `tests/losi-chat-groups.sql` passou com rollback (criação/retry, administração, 1 crédito, destinatários gratuitos, histórico após entrada, remoção, transferência, saída, saldo zero, RLS e isolamento de UUID entre privado/grupo). `tests/losi-chat-edge.cjs` cobre cancelamento/retry/timeout, pedido alheio, cliente divergente, cobrança confirmada e autenticação/roteamento dos grupos. Regressão de carteira/privado testada novamente. Sem cobrança/cancelamento real de fornecedor durante os testes.


## Imagens e documentos

O clipe no compositor seleciona um arquivo por envio. Prévia mostra imagem ou nome/tamanho, legenda opcional e custo. Máximo 20 MiB; JPG/JPEG, PNG, WEBP, GIF, PDF, TXT, DOCX, XLSX e PPTX. Imagem custa 2 créditos sem legenda ou 3 com legenda. Documento custa 2 até 2 MiB, 3 até 5 MiB, 4 até 10 MiB, 8 até 20 MiB; legenda incluída. Grupos têm o mesmo custo independentemente dos destinatários. Recebimento gratuito.

Bucket privado `losi-chat-attachments`, sem permissões diretas de leitura ou escrita para anon/authenticated. Upload autorizado por Edge com getUser, número resgatado, saldo mínimo e participação; token de upload de 2 horas sem upsert. Objeto único e imutável por tentativa. Tabela `losi_chat_uploads` exclusiva do service_role, RLS habilitado sem políticas intencionalmente; clientes não leem caminhos por consulta. Máximo de 20 prévias não enviadas por usuário; limpeza limitada a 20 arquivos expirados, reclamados sob trava com SKIP LOCKED para excluir envios em andamento, nas próximas preparações desse usuário, sem cron global. Objetos abandonados podem permanecer até o próximo uso.

Antes de salvar, Edge baixa e compara tamanho real, valida assinatura do formato e, em Office, entradas do diretório ZIP sem descompressão. Isso identifica formatos aceitos, não é antivírus nem validação integral do documento. RPC trava carteira e participação, exige upload verificado/não expirado, calcula custo por tamanho confirmado e grava mensagem, débito e ledger atomicamente. Identificadores estáveis evitam cobrança duplicada em nova tentativa, e um upload não pode ser usado em duas mensagens. Falha de upload/validação não debita. Falha na resposta após commit é reconciliada pela mesma tentativa.

Histórico retorna somente metadados dos anexos das mensagens já autorizadas. Download/visualização exige autorização de novo para cada mensagem; URLs assinadas duram 60 segundos. Grupo exige membro ativo e timestamp da mensagem >= entrada atual, comparado no banco com precisão de microssegundos. Removidos não recebem novas URLs, mas URLs já emitidas duram até 60 segundos e arquivos já baixados não podem ser revogados. Não há criptografia de ponta a ponta. Documentos são enviados como download com filename; imagens exibidas nas bolhas e também disponíveis para baixar. URLs não são persistidas no banco. Previews locais revogam ObjectURLs e consultas de imagens iniciam perto da área visível.

Verificação desta entrega: build local de produção; testes Node `losi-chat-edge.cjs`, `losi-chat-media.cjs`, `losi-chat-media-edge.cjs`; testes SQL de mensagens, grupos e mídia em transações com rollback. Conferem faixas de custo, idempotência, destinatário gratuito, saldo insuficiente, upload não verificado, permissões de mídia, RLS do Storage, histórico de grupos e limites de formato/tamanho. Fixtures não ficam gravadas e não houve cobrança real de fornecedor. Navegador indisponível: prévia, download e responsividade ainda sem verificação visual/interativa completa. Revisão Impeccable limitada ao código, sem aprovação visual por screenshots.
