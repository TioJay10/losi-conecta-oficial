# Formulários — supplier workspace extension

## Scope and authority

Mode: **Operate**. This surface helps suppliers create a form, share it, and review responses. It extends the existing supplier panel; it does not establish a new global visual system.

The user approved the preview and authorized creation. Keep the original supplier navy/gold identity on a white page, reuse the supplier rail supplied by `src/routes/__root.tsx`, and keep form styles scoped to `.lf-workspace` and `.lf-public-page`. No new image assets are required. Homepage, Chat LOSI, and public supplier search retain their own visual authority.

Implementation sources: `src/components/LosiForms.tsx`, `src/components/LosiFormFields.tsx`, `src/components/LosiPublicForm.tsx`, `src/lib/losi-forms.ts`, and `src/losi-forms.css`. Routes are `/formularios` for the supplier workspace and `/formulario/$token` for the response surface.

## Visual implementation

The light workspace (`#fbfcfe`) contains navy work surfaces (`--lf-navy: #0b1b31`). Tonal panels use `#13263e`, fields use `#0d1d33`, dividers use `#3c4c63`, and primary actions and selected states use gold (`#e2c482`). Text is `#f6f8fc`, secondary text `#c1ccda`. These are surface-local tokens; the reused rail retains its incumbent palette. Gold filled actions carry navy text. Destructive confirmation has a separate muted red treatment.

Typography uses Montserrat with Arial and sans-serif fallbacks, 14px body text and 1.55 line height. Workspace headings scale from 24px to 32px; section headings are 20px and field labels 13px. Mobile input text is 16px. Work surfaces have 12px corners, fields and buttons 6px corners, and status badges 4px corners. Shadows gently separate the dark surface from the white workspace; rows and question groups use dividers instead of independent cards.

The desktop editor has a flexible question column and a 270px settings column, separated by a vertical rule. Below 1000px, settings move under the editor and the divider becomes horizontal. Below 600px, paired fields and response filters become single-column, controls wrap, and the shared supplier navigation remains responsible for its mobile menu. Public forms use a centered surface up to 740px wide. The editor preview narrows to 680px.

Controls retain native inputs, textarea, select, date controls, checkboxes, and fieldsets. Buttons and ordinary fields have a 44px minimum height. Required fields have visible text markers; keyboard focus uses a 2px gold outline with a 3px offset. Button transitions last 0.15s and are removed for reduced motion.

## Task flow and states

- Seven templates: Solicitação de proposta, Eventos, Solicitação de contato, Pré-cadastro de vagas, Cadastro de fornecedores, Cadastro de colaboradores, and Formulário livre.
- Every form requires Nome completo. Suppliers can customize title, presentation, question labels, response types, required flags, options, and question order, then preview before saving or publishing.
- The three workspace views are Meus formulários, Respostas recebidas, and Formulários recebidos. Draft/open/closed states appear in words alongside their visual treatment.
- Audience choices are public link, invited LOSI suppliers, or both. Public token links accept responses without login when public access is enabled. Supplier invitations resolve a public supplier profile link and connect the invited supplier's response to their profile.
- Responses support search by name, origin/status/date filters, expandable details, pagination, and Nova / Em análise / Aprovada / Arquivada statuses. Status changes refresh the current filters.
- Form deletion uses a native modal dialog, explicitly names the form and the permanent loss of its responses, and focuses Cancelar initially. Response deletion uses an explicit permanent-delete confirmation. Busy actions are guarded; the editor is disabled while saving.
- Loading, empty, error/retry, submission, and success feedback are explicit. Public copy identifies the receiving business and states that answers are not displayed publicly.

## Comparison and verification evidence

Compared the implementation with the incumbent supplier rail and `PRODUCT.md`, `DESIGN.md`, and `.impeccable/design.json`. The forms surface preserves the navy/gold/white supplier identity while using its own scoped controls and density. It does not import the homepage blue/lilac palette or decorative composition.

Inspected `/workspace/scratch/forms-desktop.png`, `/workspace/scratch/forms-mobile-final.png`, and `/workspace/scratch/forms-responses-final.png`. They show the editor, its mobile stacking, and the response filters/details with the existing rail. These are viewport captures, and their demonstration content is evidence of layout rather than production account data. The mobile viewport shows only the upper editor; the rest of its responsive behavior is documented from source.

The finish reviewer reported **ship** after disabling the editor during saving and refreshing filtered responses after status changes. The parent implementation pass reported a passing build, live anonymous API and database validation tests, and no detector findings for `LosiForms.tsx`. This documentation pass did not independently rerun those functional checks or change UI source.

## Existing documentation limits

`DESIGN.md` is primarily a homepage extraction. Its supplier-panel heading and prose already occur inside the opening YAML frontmatter, which is pre-existing format drift from the token-only schema in Impeccable's document reference. The sidecar is also homepage-focused. `PRODUCT.md` primarily records the chat work and predates this Forms extension. These limits are recorded without repair: root `DESIGN.md`, `PRODUCT.md`, and `.impeccable/design.json` remain unchanged by this pass.

Preserve this brief as a narrow surface record. Future Forms changes should extend the existing shared rail and local `--lf-*` vocabulary, keep native field behavior and explicit destructive confirmations, and avoid turning Forms-specific choices into global design rules.
