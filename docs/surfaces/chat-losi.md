# Chat LOSI — número, créditos e conversas

## Escopo e referências

Modo: Operate. Extensão em `/chat-losi`, acessível pelo menu do painel principal. A etapa funcional preserva a composição aprovada da prévia e o chat existente. Inclui o cartão de compra/resgate/recarga em Minha Empresa e sua versão compacta dentro do chat, além do contato público opcional. Esta documentação descreve essas adições, sem definir um sistema visual global.

Composição fixada pelo usuário nas referências do WhatsApp: `image(20261007-001417).png` (desktop) e `IMG_6400.jpeg` (mobile). A marca mantém azul-marinho e dourado. Referências de produto e backend: `PRODUCT.md` e `docs/losi-chat.md`. Implementação: `src/components/LosiChatPreview.tsx`, `src/components/LosiChatNumberPurchase.tsx`, `src/components/LosiChatGroups.tsx`, `src/components/LosiChatAttachments.tsx`, `src/components/LosiChatAudioRecorder.tsx`, `src/lib/losi-chat.ts`, `src/chat-losi.css`, `src/losi-chat-purchase.css`, `src/losi-chat-groups.css` e `src/losi-chat-attachments.css`. O nome legado `LosiChatPreview` permanece no código, mas a página usa dados reais da conta.

## Composição e responsividade

- Desktop acima de 1100px: trilho de 64px, lista de conversas de 410px e painel restante. Entre 769px e 1100px, trilho de 60px e lista de 350px. Busca, saldo e filtros ficam acima da lista; o painel mostra boas-vindas ou a conversa selecionada.
- Mobile até 768px: cabeçalho com menu/câmera/adicionar, título Conversas, saldo, busca, filtros horizontais, lista e navegação inferior em cápsula. Navegação com Contatos, Créditos, Conversas e Você. Conversa aberta ocupa a tela e oferece voltar; lista e navegação inferior ficam ocultas nesse estado.
- A superfície ocupa `100dvh`, com áreas de rolagem próprias. O mobile considera as margens seguras superior e inferior. Até 359px, reduz avatares, recuos laterais e nomes da lista.

## Tokens observados nesta superfície

| Token CSS | Valor | Aplicação |
| --- | --- | --- |
| `--lc-bg` | `#0b182a` | Fundo principal, lista e mensagens |
| `--lc-panel` | `#101f33` | Trilho e painel principal |
| `--lc-raised` | `#1a2c43` | Busca, seleção, cabeçalho e compositor |
| `--lc-line` | `#293b52` | Divisores e bordas |
| `--lc-gold` | `#d6b46a` | Ações, saldo, indicadores e foco |
| `--lc-text` | `#f5f7fa` | Texto principal |
| `--lc-muted` | `#b7c6d9` | Texto secundário e horários |

Fonte desktop: `Arial, Helvetica, sans-serif`; mobile: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Cabeçalho desktop de 22px; título mobile de 32px. Nomes das conversas de 16px desktop e 17px mobile; prévias de 14px e 15px, respectivamente. Saldos e horários usam números tabulares.

Avatares circulares de 48px desktop e 56px mobile. Linhas de conversa de 76px desktop e mínimo de 84px mobile. Busca de 40px com raio de 28px; filtros com raio de 24px; cartão de boas-vindas com raio de 28px. Navegação mobile de 72px com raio de 40px. Profundidade por contraste tonal e divisores, com sombra no menu (`0 12px 30px #0005`) e na navegação mobile (`0 8px 28px #0004`). Foco visível: contorno dourado de 2px. Transições de fundo de 150ms somente quando não há preferência por movimento reduzido.

## Componentes adicionados

O formulário de contatos mantém a paleta do chat: recuos de 18px × 22px, campo de 16px sobre `--lc-raised`, borda `--lc-line`, raio de 6px e ação dourada. Busca pelo número digital LOSI; o parâmetro `?numero=` preenche o campo quando a entrada vem do perfil público. Fotos reais ocupam o avatar circular; iniciais aparecem quando não há foto.

O cartão de número e créditos tem fundo `#101f33`, borda `rgba(214,180,106,.3)`, raio de 10px e recuo de 24px. Cabeçalho de 20px e número/preço de 24px. Campo CPF/CNPJ de 16px, raio de 6px, borda `#405168`; pacotes com raio de 8px e recuo de 18px. Ações douradas com raio de 6px e altura mínima de 42px. Até 600px, os pacotes ficam em uma coluna, o recuo do cartão cai para 18px e o título para 18px. A versão compacta no chat remove fundo, borda e recuos externos e usa uma coluna de pacotes. O cartão tem foco branco de 2px com afastamento de 3px, distinto do foco dourado do chat.

Estados explícitos: consulta da conta, criação/conferência da cobrança, pagamento pendente, confirmação de cancelamento junto à fatura, pagamento confirmado pronto para resgate, conta com número e recarga. Avisos usam `role="status"`; mensagens usam `aria-live="polite"`. Ação de favoritos e carregamento de mensagens anteriores ficam centralizados, com raio de 6px e borda tonal.

Os grupos reutilizam a estrutura da conversa. “Novo grupo” aparece no menu e “Criar novo grupo” em Contatos; o formulário ocupa a área lateral e, no mobile, a área de lista. “Dados do grupo” no cabeçalho substitui mensagens/compositor por um painel rolável; voltar restaura a conversa. O cabeçalho mostra a quantidade de participantes, e mensagens recebidas mostram o nome do remetente em dourado.

Painéis de grupo têm recuo de 22px (18px até 600px), título de 20px, campos de 16px, raio de 6px e borda `#405168`. Ações primárias douradas têm altura mínima de 40px e hover `#e6ca88`; secundárias usam `#1a2c43`. Dados do grupo limitam a largura interna a 720px no desktop. Participantes têm avatar circular de 40px, nome de 15px, número/papel de 13px e divisores `#293b52`. Remoção, transferência e saída usam confirmação local com borda dourada, recuo de 14px, foco programático e retorno do foco à origem. Foco dos controles é dourado de 2px com afastamento de 3px. Até 420px, o cabeçalho de grupo reduz recuos e texto para acomodar dados e saldo sem mudar o shell.

O compositor de anexos preserva a posição e a paleta da conversa, com clipe, legenda opcional e envio. A seleção mostra nome, tamanho, custo e ação de remover, retornando o foco ao clipe. Prévia de imagem de 88px × 72px com raio de 6px; até 600px, 64px × 60px. A faixa usa recuo de 14px × 18px (10px × 12px no mobile), nome de 14px e informação secundária de 12px. Mensagens com anexo mantêm a bolha: imagem com altura máxima de 360px (280px no mobile), largura máxima do bloco de 360px no desktop e botão de download com altura mínima de 44px e raio de 6px. Esses estilos locais não redefinem os tokens globais.

## Interações, pagamentos e limites

Conversas, fotos, mensagens, horários, número e saldo vêm da conta autenticada. O saldo real disponível aparece na lista e no cabeçalho da conversa; saldos internos negativos são apresentados como zero disponível. O número não resgatado tem texto próprio, sem número demonstrativo. `154.444.566` permanece somente como exemplo no placeholder de busca.

A compra é opcional em Minha Empresa. Número + 10.000 créditos custa R$29,90; número + 50.000 custa R$79,90. As recargas usam os mesmos pacotes/preços e preservam o número. O componente cria a cobrança, abre o checkout Asaas em outra aba e permite verificar pagamento. Após confirmação, oferece resgatar o número exclusivo de nove dígitos, vinculado à conta. A confirmação gera notificação e créditos conforme o fluxo descrito em `docs/losi-chat.md`. Cobrança em conferência mantém a ação de verificação, sem apresentar novo pacote de compra. Publicação do número nos contatos do perfil público exige escolha explícita do proprietário.

Busca na lista por nome ou última mensagem, filtros de não lidas, favoritos e Grupos, abertura/retorno e favoritos funcionam com conversas privadas e grupos reais. Busca por número abre conversa privada. Histórico paginado em lotes de 100 oferece “Ver mensagens anteriores”. Cada texto enviado custa 1 crédito, também nos grupos, independentemente da quantidade de destinatários; recebimento é gratuito. Envio e débito são gravados atomicamente no servidor, com identificador que evita duplicação em nova tentativa. Compositor limita a 4000 caracteres e desabilita envio durante a operação, sem texto nem arquivo, sem número ou com saldo insuficiente para o custo indicado. Saldo zero preserva número e acesso às mensagens recebidas.

Grupos permitem até 100 participantes, incluindo quem cria, adicionados por número digital LOSI. Criar exige número próprio resgatado, nome até 80 caracteres e descrição opcional até 500. Quem cria administra: pode editar nome/descrição, adicionar ou remover participantes e transferir administração. Participante pode sair; administrador precisa transferir antes de sair. Cada entrada ou reentrada inicia o histórico acessível naquele momento. Saída/remoção bloqueia novas consultas; conteúdo já recebido pelo navegador não pode ser revogado retroativamente. Dados exibidos dos membros são nome profissional, foto, número LOSI e papel, conforme `docs/losi-chat.md`.

“Cancelar fatura” fica junto a “Abrir pagamento” e “Verificar pagamento” no cartão da cobrança em Minha Empresa e nas versões compactas em Créditos/Você. A confirmação adjacente oferece “Confirmar cancelamento” ou “Manter fatura”. O servidor reconcilia o pedido com Asaas e só permite excluir cobrança pendente/vencida; a interface mostra cancelamento concluído após confirmação do provedor. Pagamento confirmado é reconciliado/creditado e não cancelado por esse botão. Resultado incerto mantém o pedido para nova verificação. O botão não realiza reembolso nem cancela somente um registro local.

Atualização por consultas enquanto a página está visível: mensagens a cada 5s, lista a cada 10s e carteira a cada 15s, além das consultas após ações próprias. Não há promessa de entrega instantânea ou criptografia de ponta a ponta.

## Imagens, documentos, vídeos e áudios

Imagens, documentos, vídeos e áudios estão habilitados em conversas privadas e grupos, com uma cobrança por envio, independente do número de destinatários. O clipe abre o seletor; formatos aceitos: JPG/JPEG, PNG, WEBP, GIF, PDF, TXT, DOCX, XLSX, PPTX, MP4, MOV e WEBM. Limite de 20 MiB por arquivo. A prévia informa o custo antes de enviar; receber e baixar não debita créditos.

| Envio | Créditos |
| --- | --- |
| Imagem sem legenda | 2 |
| Imagem com legenda | 3 |
| Vídeo, com ou sem legenda | 10 |
| Áudio gravado, com ou sem legenda | 1 |
| Documento até 2 MiB | 2 |
| Documento acima de 2 até 5 MiB | 3 |
| Documento acima de 5 até 10 MiB | 4 |
| Documento acima de 10 até 20 MiB | 8 |

Legenda opcional de até 4000 caracteres; nos documentos, está incluída no custo da faixa; nos vídeos, está incluída nos 10 créditos, e nos áudios gravados no crédito único. O compositor desabilita o envio com saldo insuficiente e mostra a condição. Estados de progresso são textuais (“Enviando arquivo…” e “Conferindo e enviando…”), sem porcentagem. Falha preserva o arquivo para nova tentativa, mantendo os identificadores e a legenda original para evitar duplicação; remover o anexo permite trocar a legenda ou o arquivo.

Imagens recebidas carregam próximas da área visível; erros oferecem “Recarregar imagem”. Imagens, documentos e vídeos apresentam nome, tamanho e “Baixar arquivo”. Acesso usa armazenamento privado e URLs assinadas por 60 segundos; cada nova URL depende da participação autorizada e, em grupos, do histórico desde a entrada. Membros removidos ou que saíram não podem obter novas URLs. Arquivos já baixados e URLs anteriormente emitidas até expirar não podem ser revogados retroativamente pelo navegador.

Vídeos selecionados mostram prévia local com controles nativos, `playsInline` e `preload="metadata"`, usando ObjectURL revogada ao mudar o arquivo ou sair. A prévia ocupa a largura disponível, com fundo `#071524`, raio de 6px e altura máxima de 200px (150px até 600px). Na bolha, o vídeo tem largura de 100% e altura máxima de 360px (280px no mobile), preservando os limites do bloco de anexo e a composição azul-marinho/dourado aprovada.

Vídeos recebidos não são carregados remotamente antes da ação “Ver vídeo”. O clique consulta uma URL privada de 60 segundos e abre o player nativo com controles, `playsInline` e carregamento de metadados, sem autoplay. Erro de reprodução remove o player e oferece reabrir com nova URL ou baixar o arquivo; a posição observada é restaurada quando os metadados permitem. Reprodução depende do codec suportado pelo navegador, sem transcodificação. Privacidade, histórico desde entrada, restrição de novas URLs a membros ativos, idempotência e débito atômico seguem as regras dos demais anexos.

O botão de câmera e o atalho de documento nas boas-vindas orientam abrir uma conversa e usar o clipe; não capturam mídia diretamente. O filtro Grupos continua mostrando grupos reais ou orientação para criar o primeiro.

## Gravação e reprodução de áudio

O microfone no compositor solicita permissão somente após clique, com rótulo e tooltip “Gravar áudio · 1 crédito”. Exige número resgatado e saldo de pelo menos 1 crédito. Permissão pendente mostra “Aguardando microfone…”; indisponibilidade ou negação mostra orientação para nova tentativa. A gravação mostra contador `mm:ss / 05:00`, “Parar” e descartar. Parar oferece prévia local com controles nativos para ouvir antes de enviar; descartar remove a gravação. Nenhum upload, mensagem ou débito ocorre antes da ação de enviar.

O compositor para automaticamente após 5 minutos pelo relógio local; esse limite temporal não é um validador de duração no servidor. Gera M4A (`audio/mp4`) ou WEBA (`audio/webm`/Opus), até 20 MiB. O servidor aceita trilha de áudio sem trilha de vídeo e verifica formato/tamanho. O seletor do clipe não oferece arquivos externos de áudio nesta etapa. Envio de áudio custa 1 crédito, com legenda incluída e sem multiplicação nos grupos; ouvir, receber e baixar são gratuitos. Prévia e lista mostram “Mensagem de áudio” quando apropriado, usando os metadados de anexo do histórico/lista.

Página escondida interrompe gravação e oferece a prévia; saída, `pagehide` e desmontagem descartam e liberam microfone/temporizador. Permissão resolvida depois de cancelar ou sair libera as tracks sem salvar. Falha em iniciar limpa o gravador para permitir nova tentativa. ObjectURLs locais são revogadas ao trocar arquivo ou sair. Durante gravação, envio e edição ficam bloqueados.

Áudio local e recebido usam controles nativos de 44px de altura; prévia com largura máxima de 360px. A faixa de gravação tem contador de 13px com números tabulares, controles de altura mínima de 40px, raio de 6px e fundo `#243e60`. O compositor permite quebra de linha; até 600px, a gravação ocupa sua própria linha e esconde envio durante a captura. Recuo mobile de 12px inclui `env(safe-area-inset-bottom)`, preservando a área segura inferior. A paleta azul-marinho/dourado e a estrutura aprovada permanecem.

“Ouvir áudio” solicita URL privada de 60 segundos apenas ao clicar, sem autoplay. Erro permite reabrir com nova URL ou baixar, restaurando a posição quando possível. Participação/histórico, restrição de novas URLs a membros removidos, débito atômico e novas tentativas com identificadores estáveis seguem os demais anexos. Compatibilidade de microfone e codec depende do navegador; não há transcrição.

## Evidência e verificação

Documentação extraída dos componentes, estilos, consultas e restrições registradas em `PRODUCT.md` e `docs/losi-chat.md`, sem criação de tokens globais. A documentação de backend registra build local, testes de funções e testes SQL em transação com rollback. Também registra testes adicionais de grupos, cancelamento, mídia, vídeos e áudios, com rollback e sem cobrança/cancelamento real de fornecedor. A revisão de código das extensões de vídeo e áudio passou, incluindo correções de recuperação ao iniciar gravação, tooltip e área segura mobile; a documentação de backend registra build e testes de formatos, custos e regras de acesso. Testes do gravador usam mocks de MediaRecorder/getUserMedia, sem captura real por microfone. Esta etapa de documentação não repetiu esses testes nem realizou pagamento real de cliente. O navegador não estava disponível para verificação visual nesta etapa; não foram capturadas nem inspecionadas screenshots. A revisão de documentação foi concluída, mas a verificação visual está bloqueada pela indisponibilidade do navegador. Não há screenshots nem aprovação de fidelidade visual desta extensão; permissão/captura reais de microfone, controles nativos, codecs, recuperação de URL/posição e responsividade permanecem sem validação interativa no navegador. A correspondência visual renderizada com os uploads desktop e mobile permanece sem verificação por screenshot; os valores acima descrevem a implementação, não uma medição das imagens de referência.
