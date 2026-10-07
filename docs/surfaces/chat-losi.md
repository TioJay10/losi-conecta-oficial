# Chat LOSI — número, créditos e conversas

## Escopo e referências

Modo: Operate. Extensão em `/chat-losi`, acessível pelo menu do painel principal. A etapa funcional preserva a composição aprovada da prévia e o chat existente. Inclui o cartão de compra/resgate/recarga em Minha Empresa e sua versão compacta dentro do chat, além do contato público opcional. Esta documentação descreve essas adições, sem definir um sistema visual global.

Composição fixada pelo usuário nas referências do WhatsApp: `image(20261007-001417).png` (desktop) e `IMG_6400.jpeg` (mobile). A marca mantém azul-marinho e dourado. Referências de produto e backend: `PRODUCT.md` e `docs/losi-chat.md`. Implementação: `src/components/LosiChatPreview.tsx`, `src/components/LosiChatNumberPurchase.tsx`, `src/lib/losi-chat.ts`, `src/chat-losi.css` e `src/losi-chat-purchase.css`. O nome legado `LosiChatPreview` permanece no código, mas a página usa dados reais da conta.

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

Estados explícitos: consulta da conta, criação/conferência da cobrança, pagamento pendente, pagamento confirmado pronto para resgate, conta com número e recarga. Avisos usam `role="status"`; mensagens usam `aria-live="polite"`. Ação de favoritos e carregamento de mensagens anteriores ficam centralizados, com raio de 6px e borda tonal.

## Interações, pagamentos e limites

Conversas, fotos, mensagens, horários, número e saldo vêm da conta autenticada. O saldo real disponível aparece na lista e no cabeçalho da conversa; saldos internos negativos são apresentados como zero disponível. O número não resgatado tem texto próprio, sem número demonstrativo. `154.444.566` permanece somente como exemplo no placeholder de busca.

A compra é opcional em Minha Empresa. Número + 10.000 créditos custa R$29,90; número + 50.000 custa R$79,90. As recargas usam os mesmos pacotes/preços e preservam o número. O componente cria a cobrança, abre o checkout Asaas em outra aba e permite verificar pagamento. Após confirmação, oferece resgatar o número exclusivo de nove dígitos, vinculado à conta. A confirmação gera notificação e créditos conforme o fluxo descrito em `docs/losi-chat.md`. Cobrança em conferência mantém a ação de verificação, sem apresentar novo pacote de compra. Publicação do número nos contatos do perfil público exige escolha explícita do proprietário.

Busca na lista por nome ou última mensagem, filtros de não lidas e favoritos, abertura/retorno, busca por número e favoritos funcionam com conversas privadas reais. Histórico paginado em lotes de 100 oferece “Ver mensagens anteriores”. Cada texto enviado custa 1 crédito; recebimento é gratuito. Envio e débito são gravados atomicamente no servidor, com identificador que evita duplicação em nova tentativa. Compositor limita a 4000 caracteres e desabilita envio durante a operação, com texto vazio, sem número ou com saldo insuficiente. Saldo zero preserva número e acesso às mensagens recebidas.

Atualização por consultas enquanto a página está visível: mensagens a cada 5s, lista a cada 10s e carteira a cada 15s, além das consultas após ações próprias. Não há promessa de entrega instantânea ou criptografia de ponta a ponta.

Anexos, documentos, câmera, grupos, áudio e vídeo continuam para a próxima etapa. Controles de anexo/câmera/emojis mostram aviso e não descontam créditos; o filtro Grupos mostra estado vazio informativo. As tarifas futuras de mídia e faixas ainda indefinidas de documentos em `PRODUCT.md` não representam envios habilitados nesta entrega.

## Evidência e verificação

Documentação extraída dos componentes, estilos, consultas e restrições registradas em `PRODUCT.md` e `docs/losi-chat.md`, sem criação de tokens globais. A documentação de backend registra build local, testes de funções e testes SQL em transação com rollback; esta etapa de documentação não repetiu esses testes nem realizou pagamento real de cliente. Não foram capturadas nem inspecionadas screenshots de navegador nesta etapa de documentação. A correspondência visual renderizada com os uploads desktop e mobile permanece sem verificação por screenshot; os valores acima descrevem a implementação, não uma medição das imagens de referência.
