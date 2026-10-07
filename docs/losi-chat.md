# Chat LOSI — número, pagamentos e primeiras conversas

## Entrega

Número opcional em Minha Empresa: 10.000 créditos/R$29,90 ou 50.000/R$79,90. Recargas têm os mesmos preços e mantêm o número. Pagamento via checkout Asaas existente, com externalReference `losi_chat:<order UUID>`. Confirmação por webhook ou consulta autenticada ao Asaas; valores, cliente e ID do pagamento conferidos antes de creditar. Notificação + crédito + alteração do pedido são uma transação. Número de nove dígitos exclusivo gerado no servidor somente no resgate de uma compra inicial paga. Publicação do número no perfil é opt-in.

Texto privado custa 1 crédito; destinatário recebe gratuitamente. Busca pelo número interno, favoritos, não lidas, histórico paginado de 100 mensagens e saldo real. Atualizações por consulta enquanto a página está visível: mensagens 5s, lista 10s, carteira 15s e após as próprias ações. Não promete entrega instantânea nem criptografia de ponta a ponta. Imagens, documentos, vídeos e áudios estão habilitados em conversas privadas e grupos. Áudios gravados no microfone estão habilitados, por 1 crédito por envio.

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


## Imagens, documentos e vídeos

O clipe no compositor seleciona um arquivo por envio. Prévia mostra imagem, vídeo com controles ou nome/tamanho, legenda opcional e custo. Máximo 20 MiB; JPG/JPEG, PNG, WEBP, GIF, PDF, TXT, DOCX, XLSX, PPTX, MP4, MOV e WEBM. Imagem custa 2 créditos sem legenda ou 3 com legenda. Documento custa 2 até 2 MiB, 3 até 5 MiB, 4 até 10 MiB, 8 até 20 MiB; legenda incluída. Grupos têm o mesmo custo independentemente dos destinatários. Recebimento gratuito.

Bucket privado `losi-chat-attachments`, sem permissões diretas de leitura ou escrita para anon/authenticated. Upload autorizado por Edge com getUser, número resgatado, saldo mínimo e participação; token de upload de 2 horas sem upsert. Objeto único e imutável por tentativa. Tabela `losi_chat_uploads` exclusiva do service_role, RLS habilitado sem políticas intencionalmente; clientes não leem caminhos por consulta. Máximo de 20 prévias não enviadas por usuário; limpeza limitada a 20 arquivos expirados, reclamados sob trava com SKIP LOCKED para excluir envios em andamento, nas próximas preparações desse usuário, sem cron global. Objetos abandonados podem permanecer até o próximo uso.

Antes de salvar, Edge baixa e compara tamanho real, valida assinatura do formato e, em Office, entradas do diretório ZIP sem descompressão. Isso identifica formatos aceitos, não é antivírus nem validação integral do documento. RPC trava carteira e participação, exige upload verificado/não expirado, calcula custo por tamanho confirmado e grava mensagem, débito e ledger atomicamente. Identificadores estáveis evitam cobrança duplicada em nova tentativa, e um upload não pode ser usado em duas mensagens. Falha de upload/validação não debita. Falha na resposta após commit é reconciliada pela mesma tentativa.

Histórico retorna somente metadados dos anexos das mensagens já autorizadas. Download/visualização exige autorização de novo para cada mensagem; URLs assinadas duram 60 segundos. Grupo exige membro ativo e timestamp da mensagem >= entrada atual, comparado no banco com precisão de microssegundos. Removidos não recebem novas URLs, mas URLs já emitidas duram até 60 segundos e arquivos já baixados não podem ser revogados. Não há criptografia de ponta a ponta. Documentos são enviados como download com filename; imagens exibidas nas bolhas e também disponíveis para baixar. URLs não são persistidas no banco. Previews locais revogam ObjectURLs e consultas de imagens iniciam perto da área visível.

Verificação desta entrega: build local de produção; testes Node `losi-chat-edge.cjs`, `losi-chat-media.cjs`, `losi-chat-media-edge.cjs`; testes SQL de mensagens, grupos e mídia em transações com rollback. Conferem faixas de custo, idempotência, destinatário gratuito, saldo insuficiente, upload não verificado, permissões de mídia, RLS do Storage, histórico de grupos e limites de formato/tamanho. Fixtures não ficam gravadas e não houve cobrança real de fornecedor. Navegador indisponível: prévia, download e responsividade ainda sem verificação visual/interativa completa. Revisão Impeccable limitada ao código, sem aprovação visual por screenshots.


### Vídeos

Vídeos custam 10 créditos por envio, sem multiplicar por participantes nem cobrar adicional por legenda. O mesmo compositor recebe MP4, MOV e WEBM de até 20 MiB, com ObjectURL local revogada ao mudar arquivo/sair. Backend confere formato real: MP4/MOV exigem marca compatível, dados mdat e trilha de vídeo em moov/trak/mdia/hdlr; WEBM exige DocType webm, segmento com cluster e TrackType vídeo. Contêiner somente de áudio, arquivo truncado e extensão falsificada são rejeitados. Inspeção limitada de contêiner, sem transcodificação nem varredura antivírus; reprodução depende do codec suportado pelo navegador.

Na mensagem recebida, “Ver vídeo” pede uma nova URL privada de 60 segundos quando clicado, e abre controles nativos com playsInline e preload metadata. Não há autoplay nem carregamento remoto de vídeos antes desse clique. Se o vídeo/URL não puder reproduzir, o usuário pode reabrir com nova URL (posição é restaurada quando possível) ou baixar. URLs já emitidas seguem o prazo mesmo após remoção do grupo; bytes já baixados não podem ser revogados. Vídeos compartilham idempotência, débito atômico, regras de participação/histórico e limpeza segura dos outros anexos.

Verificação adicional: `tests/losi-chat-videos.cjs` gera vídeos reais via ffmpeg em pasta temporária, verifica MP4/MOV/WEBM, rejeita áudio-only/falsificação/truncamento e confere custo no compositor. `tests/losi-chat-videos.sql` testa vídeo privado/grupo, tamanho e legenda, saldo insuficiente, um ledger/débito por envio, destinatário gratuito, membros removidos e histórico desde entrada; tudo em rollback. Testes de mídia anteriores e build de produção passaram. Typecheck geral contém erros preexistentes em páginas fora do chat; nenhum erro nas alterações Chat LOSI. Revisão Impeccable do código passou; browser, codecs, recuperação de URLs e responsividade visual continuam sem validação interativa por indisponibilidade do navegador.


### Mensagens de áudio

Usuário escolheu 1 crédito por áudio. O botão de microfone grava usando MediaRecorder; tipo escolhido por isTypeSupported entre audio/mp4 e audio/webm (Opus). Saldo >=1/número resgatado exigidos para iniciar pelo compositor. Só solicita microfone após clique. Permissão negada/indisponível mostra erro com orientação, e falha ao iniciar limpa o gravador permitindo tentar novamente. Nenhum upload, mensagem ou débito ocorre durante gravação/prévia.

Contador e parada automática aos 5 minutos são controlados no compositor pelo relógio; página escondida interrompe gravação, saída/unmount descarta e libera tracks/timer. Permissão resolvida depois de cancelar/saída libera o microfone sem salvar. Usuário pode parar, ouvir a prévia ou descartar; gravação não envia automaticamente. Arquivos gerados M4A/WEBA, até 20 MiB, ficam em ObjectURL local revogada ao trocar/sair. Não há upload de arquivos de áudio no seletor do clipe nesta etapa. Servidor verifica tamanho e trilha de áudio sem trilha de vídeo; limite temporal da gravação é do compositor, não um validador de duração no servidor.

Enviar usa o mesmo upload privado, RPC atômica e IDs estáveis de mídia. Áudio custa 1, também no grupo e com legenda, sem multiplicação por destinatários. Receber, ouvir e baixar não descontam. Histórico retorna tipo/nome/tamanho autorizado; lista mostra “Mensagem de áudio” quando não há legenda. “Ouvir áudio” obtém URL privada de 60s sob as mesmas regras de participação e entrada no grupo. Controles nativos reproduzem; erro permite reabrir/baixar, restaurando posição quando possível. Não há autoplay. Compatibilidade de codec/microfone depende do navegador; nenhuma transcrição foi implementada.

Testes adicionais: `losi-chat-audio.cjs` usa arquivos reais ffmpeg para audio-only M4A/WEBA, rejeita vídeo disfarçado/falsificação/truncamento e confere custo1; `losi-chat-audio-recorder.cjs` simula MediaRecorder/getUserMedia para limite5min, prévia, cancelamento, erro/negação, falha em start seguida de retry, permissão tardia, rejeição de pedido antigo e limpeza de saída; `losi-chat-audio.sql` confirma custo1 com/sem legenda, idempotência/ledger, grupo/privado, receptor gratuito, falta de saldo e permissões/histórico, tudo em rollback. Regressões de mídia e vídeos passaram. Build de produção passou. Testes de gravação são mocks, sem interação real com microfone; navegador indisponível e revisão visual bloqueada. Revisão Impeccable de código corrigiu recuperação de start() e safe-area no mobile. Typecheck global continua com erros preexistentes fora do chat.


### Menu de mídia, exclusão e progresso de upload

Imagens, áudios e vídeos enviados deixam de mostrar rodapé fixo de nome/tamanho/download. Pressão longa de 500ms, menu de contexto e Shift+F10/tecla de menu abrem opções; documentos abrem pelo botão do nome. Menu oferece baixar, excluir só para mim e excluir para todos apenas ao remetente. Exclusão pessoal persiste por usuário no banco. Exclusão para todos exige confirmação, marca a mensagem como excluída logicamente e não devolve créditos. Autorizações de histórico, lista e novas URLs respeitam a exclusão. URLs já emitidas expiram em até 60 segundos; conteúdo baixado ou em cache não pode ser revogado retroativamente.

Upload usa a URL assinada retornada por prepare-media, via PUT com XMLHttpRequest, progresso computável e timeout de 180 segundos. Preparar/enviar têm espera máxima de 60 segundos no cliente. Resultado incerto mantém arquivo, legenda e UUIDs estáveis para nova tentativa; operação idempotente impede novo débito ou mensagem duplicada. A interface diferencia preparação, porcentagem enviada e conferência/gravação. Completar upload não equivale a concluir a mensagem: a etapa send-media ainda verifica e grava com débito atômico.

Revisão documental limitada ao código; build e SQL em rollback são verificados separadamente nesta entrega. Menu por toque/teclado, upload real no navegador, reprodução/download e responsividade permanecem sem validação interativa, pois o navegador está indisponível. Não há screenshots nem aprovação de fidelidade visual desta extensão.

### Notificações no painel

Novas mensagens individuais e de grupos criam um aviso privado no sistema de notificações existente. Há no máximo um aviso não lido por conversa e destinatário; novas mensagens atualizam esse aviso. O conteúdo da mensagem não é copiado para o aviso. O link ` /chat-losi?conversa=<uuid>` abre somente uma conversa retornada pelo backend para a conta autenticada. Ler a mensagem mais recente confirma a leitura do aviso; entrega ou leitura de mensagens anteriores não o encerra. São notificações dentro do app, sem push do sistema operacional. A geração ocorre na mesma transação dos recibos, sem cobrança adicional de créditos.

Verificação: `tests/losi-chat-notifications.sql` usa transação com rollback para validar destinatários, agrupamento, privacidade, links de grupos e sincronização de leitura.

### Respostas a mensagens

Segurar uma mensagem no celular ou abrir seu menu contextual no desktop oferece “Responder”. Texto, áudio, imagem, vídeo e documento podem ser a mensagem original. A seleção aparece acima do compositor e pode ser cancelada antes do envio. O envio mantém o custo normal do conteúdo: citar uma mensagem não acrescenta créditos. A referência é salva com a mensagem, na mesma transação da cobrança, com as tentativas repetidas preservando o mesmo envio.

Citações limitam o trecho a 240 caracteres e duas linhas. Mensagens excluídas, ocultas para o leitor ou anteriores à entrada dele no grupo aparecem como “Mensagem indisponível”. Não se aceita responder a mensagens de outra conversa. RPCs de envio e consulta das citações são exclusivas do backend autenticado.

Verificação: `tests/losi-chat-replies.sql` (rollback) e `tests/losi-chat-reply-edge.cjs` cobrem permissões, privacidade, grupo, anexos, custo e novas tentativas.

### Busca dentro da conversa

A lupa do cabeçalho abre uma busca de texto, legenda e nome de arquivo na conversa atual. A pesquisa é literal e ignora diferenças entre maiúsculas e minúsculas. As setas percorrem os resultados do mais recente para o mais antigo, carregando páginas adicionais de 50 ocorrências. O contador com `+` indica mais resultados disponíveis. Selecionar uma ocorrência carrega e destaca a mensagem no histórico, sem consumir créditos ou marcar os resultados pesquisados como lidos.

O servidor limita a consulta à conversa autorizada, exclui mensagens apagadas/ocultas e respeita a data de entrada nos grupos. Arquivos são encontrados pelo nome, sem leitura do conteúdo do documento ou transcrição de áudio. Testes com rollback: `tests/losi-chat-search.sql`.
