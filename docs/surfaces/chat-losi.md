# Chat LOSI — página de prévia

## Escopo e referências

Modo: Operate. Extensão isolada em `/chat-losi`, acessível pelo menu do painel principal. Preserva as demais páginas e o chat existente; esta documentação descreve somente a nova superfície, sem definir um sistema visual global.

Composição fixada pelo usuário nas referências do WhatsApp: `image(20261007-001417).png` (desktop) e `IMG_6400.jpeg` (mobile). A marca mantém azul-marinho e dourado. Referência de produto: `PRODUCT.md`; implementação: `src/components/LosiChatPreview.tsx` e `src/chat-losi.css`.

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

## Interações e limites da prévia

Navegação, busca por nome ou texto, filtros, abertura/retorno de conversas e visualização dos pacotes são estados locais. Enviar, anexar, emojis e câmera apresentam aviso de prévia. Compra permanece desabilitada. Não há backend de mensagens, arquivos, pagamento, notificações, número digital ou créditos.

Contatos, mensagens, horários, número `154.444.566` e saldo de `10.000` créditos são ilustrativos e identificados na interface. O saldo aparece na lista e no cabeçalho de uma conversa aberta. Nenhum envio, débito, compra ou vínculo de número acontece.

Os pacotes iniciais exibidos seguem `PRODUCT.md`: número + 10.000 créditos por R$29,90 e número + 50.000 por R$79,90. A interface informa a futura compra opcional em Minha Empresa, o resgate após confirmação e a permanência do número após acabar o saldo. Recargas avulsas e faixas de tamanho dos documentos continuam indefinidas.

## Evidência e verificação

Documentação extraída do código e das restrições registradas em `PRODUCT.md`, sem criação de tokens globais ou alteração de páginas fora do escopo. Não foram capturadas nem inspecionadas screenshots de navegador nesta etapa de documentação. A correspondência visual renderizada com os uploads desktop e mobile permanece sem verificação por screenshot; os valores acima descrevem a implementação, não uma medição das imagens de referência.
