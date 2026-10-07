# Chat LOSI — número, pagamentos e primeiras conversas

## Entrega

Número opcional em Minha Empresa: 10.000 créditos/R$29,90 ou 50.000/R$79,90. Recargas têm os mesmos preços e mantêm o número. Pagamento via checkout Asaas existente, com externalReference `losi_chat:<order UUID>`. Confirmação por webhook ou consulta autenticada ao Asaas; valores, cliente e ID do pagamento conferidos antes de creditar. Notificação + crédito + alteração do pedido são uma transação. Número de nove dígitos exclusivo gerado no servidor somente no resgate de uma compra inicial paga. Publicação do número no perfil é opt-in.

Texto privado custa 1 crédito; destinatário recebe gratuitamente. Busca pelo número interno, favoritos, não lidas, histórico paginado de 100 mensagens e saldo real. Atualizações por consulta enquanto a página está visível: mensagens 5s, lista 10s, carteira 15s e após as próprias ações. Não promete entrega instantânea nem criptografia de ponta a ponta. Anexos, grupos, áudio e vídeo não foram habilitados nesta etapa.

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
