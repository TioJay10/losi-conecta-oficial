# Lia — chat de planejamento

## Scope and authority

Mode: **Operate**. `/plano-de-trabalho` now opens the Lia conversation as the principal screen, as the user chose. This is a code-led extension of the existing LOSI planner and Lia content service. The user pinned the ChatGPT topology, adapted with the incumbent LOSI navy, gold, Montserrat and approved mascot. The guided editor remains an alternative. The homepage, paid-credit Chat LOSI and global identity are separate surfaces.

Implementation sources: `src/components/LiaPlanningChat.tsx`, `src/lia-planning-chat.css`, `src/components/WorkPlanner.tsx`, `src/routes/plano-de-trabalho.tsx` and `src/routes/__root.tsx`. The authenticated route owns its chat shell; the shared supplier rail is not rendered alongside it. Existing rail/dashboard entries still lead to the route. No backend changes or new rasters were introduced. The supplied attachment was unavailable and is not inspected evidence.

## Direction contract

This contract records the implementation after it was built; it is not a pre-implementation approval or seed. The fixed user-pinned composition makes an alternative-world workshop and concept seed inapplicable.

THESIS: A conversation is the working surface for continuing and revising a plan, using the familiar ChatGPT composition expressly requested by the user.

OWN-WORLD: Existing LOSI navy and gold identify history, controls and mascot; white supports long reading. Existing Montserrat remains the authority for this supplier surface.

STORY: Start from an idea, receive a response from existing Lia, ask for changes, and reopen the conversation. Guided stages retain their state when switching and can pass a briefing into a new conversation.

FIRST VIEWPORT: Desktop has a history rail, sparse Lia header, centered mascot/welcome, starter pills and bottom composer with a circular arrow submit. Mobile turns the history into a drawer. User messages align right in pale bubbles; Lia replies appear as open prose. Sending changes the welcome into the conversation in the same shell, and actual request state drives the working mascot.

FORM: User-pinned ChatGPT topology with LOSI colors/assets; code-led existing-surface extension, without a separately approved comp. Review covers welcome, conversation, history and composer states.

FINISH: The finish reviewer returned **SHIP**, with no material fixes required. Scoped documentation records the delivered surface and existing-asset provenance without rewriting global identity.

## Visual implementation and responsive layout

The surface uses navy (`--lia-navy: #0b1b31`) and gold (`--lia-gold: #e2c482`), white reading space, ink (`#172438`), gray supporting text and pale neutral user/composer surfaces. The history rail is (270px), narrowing to (240px) at (1000px). The shell fills (100dvh), with a minimum height of (500px), reduced to (420px) at the mobile breakpoint. The reading area scrolls independently while the composer remains at the bottom of the flex layout. Message measure is bounded at (760px); composer area at (808px).

Montserrat with Arial/sans-serif fallbacks carries the existing identity. Welcome headings use (23–32px), desktop replies (15px, 1.85 leading), and the composer (15px). At (760px) and below, headings use (25px), replies (14px), and the textarea (16px). Supporting status and footnote type remains compact. The desktop composer has (26px) corners; mobile (23px). Starter actions are pills, history rows have (8px) corners, and submit is a (36px) circle. Soft depth is limited to the composer and Lia information disclosure.

At (760px) and below, the rail becomes a fixed drawer of at most (300px / 86vw), with a scrim, close control and visible delete controls. Keyboard opening moves focus into the drawer; Tab is contained and Escape restores focus to the opener. Explicit close/scrim actions also restore focus. Controls retain visible gold focus treatments. Mobile spacing and safe-area bottom padding preserve the composer. Reduced-motion CSS removes the drawer transition; the reused mascot already supplies reduced-motion behavior. No new motion or mascot asset system was created.

## Conversation behavior and boundaries

- The three starter actions fill the composer and focus it; they do not send automatically. Input is limited to (2000) characters. Enter sends, Shift+Enter adds a line, and IME composition is respected. Busy state prevents duplicate sends and conversation changes.
- The existing `callLosiAi` service is queried for status, then called with `action: generate`, `kind: material`, educational tone and standard depth. Configured service, allowed access and remaining material quota gate sending. Status/activation/quota messages and a retry for status failure remain visible. The composer discloses “Cada resposta concluída usa 1 geração de materiais.” This is the existing Lia material allowance, not paid-credit Chat LOSI messaging.
- Each request includes the latest user message, up to the last (2800) characters of prior conversation text, and the optional guided briefing as context. The existing service instruction contract is (6000) characters; this is bounded recent context, not an unlimited conversation memory. Replies render as plain text preserving line breaks, without markdown rendering or streaming. Instructions require distinction between suggestions and confirmed facts and prohibit invented internet research, catalog retrieval, market prices and generated PDFs; these are instructions to the model, not verified factual guarantees.
- Sending adds the user turn and a real pending indicator. A failed send removes that pending turn, restores the user's input and reports the error. Status is refreshed after completion. Replies expose a copy action with success/failure feedback.
- Conversations are schema-checked and account-separated under `losi-lia-planning-v1:<userId>` in browser storage. Search matches titles; users can reopen, start a new conversation or delete with confirmation. Updated threads move to the top. The UI explicitly says history is saved on this device. There is no server synchronization. Invalid/unavailable storage reports the problem and prevents overwriting unreadable history; new conversations then remain in the session.
- The route keeps the chat mounted and, after first opening, also keeps the guided editor mounted while switching visibility. “Etapas guiadas” and “Planos e rascunhos” open the existing four-stage manual editor. “Continuar este plano com a Lia” serializes the current briefing into a new chat, shows that context in a disclosure and pre-fills a request. It does not send automatically. The subsequent plan-link integration saves the briefing before transfer, reuses the linked conversation, and allows each reply to update the corresponding saved plan body.

Internet research with sources, retrieval of LOSI suppliers, operational sizing/calculation integrations and planner PDF export remain forthcoming. The header disclosure, composer footnote and guided upcoming section identify these boundaries. Existing proposal/PDF surfaces elsewhere remain intact. No fake conversation messages or supplier results ship in the chat; QA replies are fixtures. The guided editor retains its explicitly labeled example and live manual briefing preview.

## Assets, comparison and verification evidence

The welcome and working states reuse `LiaMascot`, `/lia-pavoa.webp` and `/lia-pavoa-sprites.webp`; the response author reuses `/lia-pavoa.webp`. These are existing approved LOSI assets, unchanged in this slice. No generated, sourced or derivative raster was added. The six review captures are evidence, not shipping assets:

- `.impeccable/review/lia-desktop.png`
- `.impeccable/review/lia-conversation-desktop.png`
- `.impeccable/review/lia-390.png`
- `.impeccable/review/lia-768.png`
- `.impeccable/review/lia-mobile-history.png`
- `.impeccable/review/lia-conversation-mobile.png`

The finish reviewer reviewed these valid desktop/mobile welcome, conversation and history captures and returned **SHIP**, with no material fixes. The implementation pass reported a passing release build and browser mock checks for send/context/history, error restoration, local persistence, sidebar keyboard behavior, guided transfer, activation gates and (1440/768/390) widths. No production paid generation was called. The repository TypeScript check has unrelated existing failures; no new-file TypeScript errors were reported. This documentation pass compared actual source and recorded the supplied verification outcome; it did not independently rerun functional tests or claim production deployment.

Compared with `PRODUCT.md`, homepage-scoped `DESIGN.md` and `.impeccable/work-planner.md`, this surface preserves the incumbent supplier identity while implementing the user's fixed chat topology. `/tmp/lia-detect.json` flags Montserrat and color/type/radius differences against the homepage palette and ramp. Those findings are intentional incumbent preservation, not authorization to repair global design drift. `DESIGN.md` remains the existing homepage extraction; its pre-existing frontmatter format drift and global sidecar are outside this scope.

Future changes should preserve this local composition and align capability labels with actual integrations. Do not promote the chat topology, composer geometry or guided layout into a global identity rule.

## Plan linking — subsequent functional integration

`PlanningWorkspace` now coordinates chat and editor. Each response can be applied to a new or linked work/business draft, opening the review step with editable `generatedContent`. Title initializes a new plan; existing briefing metadata stays intact. Applying a later response deliberately replaces the plan body, while earlier responses remain in conversation history. It saves locally and records the draft ID on the conversation; reload preserves the relationship. Returning from the editor saves manual text and sends it back as `currentPlan`, reusing the conversation for the same draft. Drafts without the optional new body field remain readable.

The existing authenticated/quotated `losi-ai-content` service now accepts `context.currentPlan` up to 20,000 characters without truncating it to the older 2,000-character briefing limit; oversized plans are rejected before reservation. Only that extraction/size guard was patched into the deployed function, preserving its existing authentication, entitlement and billing. The previous SHIP review applies to the visual chat release, not a new independent review of this functional addition. Subsequent validation: release build, browser mock generation/apply/edit/revision/reload flows for both types, and server regression tests of auth/quota/context limits; no paid production generation used.
