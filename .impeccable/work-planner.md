# Plano de trabalho — supplier workspace extension

## Scope and authority

Mode: **Operate**. The user originally chose a guided flow through Demanda, Evento, Serviços, and Revisão; the subsequent Lia extension makes chat the principal route screen and retains this flow as “Etapas guiadas”. This surface extends the established supplier workspace and does not establish a new visual world. The existing supplier rail, its mobile navigation, and the navy/gold/white identity remain the authority. The homepage and Chat LOSI retain their separate surface rules.

Implementation sources: `src/components/WorkPlanner.tsx`, `src/work-planner.css`, and `src/routes/plano-de-trabalho.tsx`. The authenticated supplier route is `/plano-de-trabalho`, with an entry in the shared rail and a dashboard link. This brief records this surface only; it does not refresh global design or product documentation.

## Visual implementation

The surface-local palette uses navy (`--wp-navy: #0b1b31`), tonal navy (`#13263e`), gold (`--wp-gold: #e2c482`), white paper, and a near-white workspace (`#fbfcfe`). Dark fields (`#0d1d33`) and quiet dividers (`#3c4c63`) preserve the incumbent Forms vocabulary. Gold identifies primary actions, the active stage, selected choices, and editor headings. Gold filled actions have navy text. The reused rail retains its existing palette.

Typography uses Montserrat with Arial and sans-serif fallbacks: body (14px, 1.6 leading), page heading (26–34px), editor heading (24px), and field labels (13px). Mobile fields use (16px). Existing `PanelMenuIcon` icons provide functional navigation and action cues; no new imagery or decorative identity is introduced.

The editor has restrained rounded corners (10px), buttons and fields (6px), and the paper preview (4px). Soft shadows separate the navy editor and white preview from the workspace. The review uses dividers and text hierarchy rather than a card per fact. Keyboard focus uses a visible gold outline (2px, 4px offset); ordinary buttons have a (44px) minimum height and fields a (46px) minimum height. Native fields, radio groups, and browser validation remain intact. Stage changes focus the stage heading. The short stage entrance animation is removed for reduced motion.

## Layout and responsive behavior

The original workspace is bounded at (1540px), constrained to (1380px) inside the current Lia guided wrapper, with a four-stage navigator above a two-column editor/preview composition. The desktop grid divides available space approximately (1.7:1), with a minimum preview width of (280px); the preview is sticky within the workspace. At (1100px), editor padding and gaps tighten and choice groups stack. Below (940px), the preview follows the editor and the paper/upcoming block share a row. Below (600px), these become one column, paired fields and choice groups stack, the header action fills the width, and footer controls wrap. The four stage controls remain visible with shorter vertical arrangements. Within the current route, the Lia shell owns history navigation and the guided alternative is reached from the chat; its header returns to the chat without discarding mounted editor state. The original shared supplier rail is not rendered alongside this route.

The white paper is a live cover/briefing preview, with document type, title, client, category, location, date, audience count, and manually entered services. It accompanies editing and changes with the internal/client presentation choice. Its “Prévia do briefing” label is part of the functional boundary: it is not a generated full plan or a PDF.

## Task flow and states

- Demanda records work/business planning type, required plan name, required demand description, and an optional niche. Forward stage navigation uses native validation of the current form. Description requires at least ten characters. Manual draft saving requires a nonblank title and may preserve an incomplete briefing.
- Evento records client, city/state, date, duration, participant count, audience, and available space. Unresolved details may remain blank.
- Serviços lets the supplier add/remove named services, record their existing team/equipment, enter an optional budget, and add priorities. Duplicate service names are rejected without adding a second item. The budget is explicitly user-entered, not a market quote.
- Revisão displays the manual briefing and offers Plano interno or Proposta ao cliente. Revisar e salvar stores the draft and provides review feedback; edits clear that feedback. These presentation choices do not generate operational estimates or commercial calculations.
- Criar plano and Meus rascunhos expose manual create, reopen, update, and delete operations. Saved drafts are account-separated in browser storage under `losi-work-plans-v1:<userId>` and explicitly described as saved on this device. They are not synchronized to a server or another device. Reopening/new/example actions confirm before discarding unsaved edits; deleting a draft names it in a browser confirmation. Unsaved changes also install a page-unload guard.
- Invalid/unavailable storage produces explicit feedback and protects existing unreadable data from overwrite. Save failure and delete failure are reported. Category failure has retry feedback and allows service descriptions to continue.
- Categories are queried from the existing `categories` table, selecting `id,name`, filtering active records, and ordering by name. The fixture's supplied categories demonstrate UI behavior; they are not evidence of a production category request.
- “Experimentar com um exemplo” inserts synthetic Festa da espuma data for 80 children, Cotia/SP, four hours, and manually listed services. It is labeled as an example and must be adjusted for the event. This example is not an AI result, a supplier recommendation, or a sizing calculation.

## Capability boundary

This guided alternative remains a manual briefing editor, local draft manager, and live briefing preview. The principal chat now integrates the existing Lia material-generation service and can receive this editor’s current briefing through “Continuar este plano com a Lia”; transfer saves the local draft, reuses its linked conversation when present and pre-fills a request without automatically sending. Each chat reply can now be applied to the corresponding work/business draft as editable generatedContent, preserving manually entered briefing fields; subsequent applications replace the plan body and keep the same saved ID. Manual revisions return to Lia as currentPlan context. See `.impeccable/lia-planning-chat.md` for the delivered chat behavior and SHIP review. **LOSI supplier retrieval, internet price research with sources, operational sizing/calculation integrations, and plan/proposal PDF generation remain upcoming.** The guided section is titled “Planejamento com IA”, says “Em breve”, and ends with “Integrações em breve”; its listed integrations and the review’s future PDF copy remain forthcoming. No internet price search, supplier matching, automatic dimensioning, margin/cost computation or PDF generation is implemented in this slice.

## Comparison and verification evidence

Compared source with `PRODUCT.md`, homepage-scoped `DESIGN.md`, and `.impeccable/forms.md`. The implementation carries forward the established supplier navy/gold colors, Montserrat, compact native controls, existing icons, and restrained depth/corners. It does not import the homepage blue/lilac palette, Inter hierarchy, or pill geometry.

Reviewed actual component fixture captures at `.impeccable/review/planner-desktop.png` and `.impeccable/review/planner-390.png`. They show the shared rail, desktop editor/paper relationship, mobile stacked review, selected client presentation, manual figures, and explicit upcoming AI/PDF copy. Additional implementation captures are `planner-review-desktop.png`, `planner-mobile.png`, and `planner-768.png` in the same directory. Fixture content is synthetic evidence of layout and interaction, not production account data.

The parent implementation pass reported passing browser checks for guided steps, required fields, save/reload/reopen, and responsive overflow, plus a passing latest release build. The repository's baseline TypeScript check has unrelated pre-existing failures; no new-file type errors were reported. This documentation pass did not independently rerun these functional checks. The final finish reviewer verdict is **ship**: all listed material copy fixes were resolved. That original guided-surface review confirmed the source and screenshots identified AI planning, internet research with sources, supplier suggestions, and PDFs as forthcoming; that review also confirmed ambiguous next-stage wording was removed in favor of “Integrações em breve”. The later chat extension implements existing Lia content generation only, as documented in its scoped brief. This verdict covers the reviewed implementation; no production deployment is claimed.

## Existing documentation limits

`DESIGN.md` remains a homepage extraction, with pre-existing supplier-panel prose placed inside its opening YAML frontmatter. That is format drift from the token-only schema in Impeccable's document reference. Its homepage font, palette, and radii are not the authority for this supplier surface. The detector flagged supplier type/color/radius differences against those homepage rules; those differences preserve the original supplier system rather than establish a new one. `PRODUCT.md` primarily records Chat LOSI and predates this planner extension. These limits are recorded without changing `PRODUCT.md`, `DESIGN.md`, or the global sidecar.

Future planner work should extend the scoped supplier vocabulary and keep capability labels aligned with implemented behavior. Do not turn this task's guided composition or paper preview into a global rule, and do not present upcoming integrations as working controls.
