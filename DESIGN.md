---
name: LOSI Conecta — homepage
description: Homepage-only design extracted from the Asaas-inspired event-professional composition.

## Supplier panel surface

The supplier workspace retains its current navigation and responsive layout, with the original LOSI navy, gold and white page colors restored at the user's request. Existing page styles are the authority for cards, controls and headings. The shared rail uses navy #07111f / #0b182a, gold #d6b46a and soft gold #f0d99a. Chat LOSI and public search remain independent surfaces.

colors:
  hero-blue: "#1648e5"
  hero-deep: "#0734cc"
  hero-end: "#15248e"
  blue: "#123cdb"
  button: "#163dd9"
  navy: "#092269"
  lilac: "#b5a0f4"
  gold: "#d6b46a"
  final-button: "#e5d19e"
  white: "#ffffff"
  ink: "#1d1d1f"
  muted: "#556184"
  lilac-surface: "#f2effb"
  workflow-surface: "#f4f2fb"
  input-border: "#c9ccd4"
  divider: "#e1e5ef"
  demo-navy: "#102761"
typography:
  display:
    fontFamily: 'Inter, "Segoe UI", sans-serif'
    fontSize: "clamp(30px, 3vw, 40px)"
    fontWeight: 650
    lineHeight: 1.22
    letterSpacing: "-0.02em"
  headline:
    fontFamily: 'Inter, "Segoe UI", sans-serif'
    fontSize: "clamp(27px, 3vw, 38px)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontSize: "21px"
    fontWeight: 650
  body:
    fontFamily: 'Inter, "Segoe UI", sans-serif'
    lineHeight: 1.5
  hero-body:
    fontSize: "17px"
    lineHeight: 1.5
  label:
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.35
rounded:
  input: "8px"
  demo: "14px"
  photo: "18px"
  panel: "24px"
  pill: "32px"
spacing:
  field-inline: "15px"
  card: "24px"
  section-inline: "32px"
  section-block: "88px"
  mobile-inline: "22px"
  mobile-block: "56px"
components:
  button-primary:
    backgroundColor: "{colors.button}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "16px 28px"
  button-final:
    backgroundColor: "{colors.final-button}"
    textColor: "#152960"
    rounded: "{rounded.pill}"
    padding: "16px 28px"
  input-email:
    backgroundColor: "{colors.white}"
    textColor: "#17284b"
    rounded: "{rounded.input}"
    height: "54px"
    padding: "0 15px"
  workflow-panel:
    backgroundColor: "{colors.workflow-surface}"
    rounded: "{rounded.panel}"
    padding: "42px 30px"
  demo-tag:
    backgroundColor: "#f0e9ff"
    textColor: "#48347b"
    rounded: "5px"
    padding: "4px 7px"
---

# Design System: LOSI Conecta — homepage

## Overview

**Creative North Star: "Conexões para o próximo evento"**

This document applies only to the homepage implemented in `src/components/HomePage.tsx` and `src/home-asaas.css`. The requested Asaas homepage composition is adapted to event professionals through LOSI branding, blue and lilac, a transparent image of two event professionals, and restrained gold. Its role is to help visitors discover suppliers and begin registration.

This is a source-code extraction, without supplied screenshots or a rendered visual assessment. Existing `PRODUCT.md` describes the separate Chat LOSI surface; its navy-and-gold identity and the other page styles remain outside this homepage design scope. The homepage's feature descriptions are source copy, not a new verification of service availability.

**Key Characteristics:**

- Blue gradient hero with left-aligned copy and a white email card.
- Two event professionals on the right, with transparent image edges.
- White resource sections, lilac supporting surfaces, and navy closing action.
- Pill actions, clear selected controls, and restrained gold focus accents.

## Colors

### Primary

The hero uses `hero-blue`, `hero-deep`, and `hero-end` in a diagonal gradient. `blue` identifies selected comparison and resource controls; `button` fills primary actions. `navy` anchors the closing section.

### Secondary

`lilac` supplies the supporting brand accent. Pale lilac surfaces distinguish workflow and audience content without adding another saturated section.

### Tertiary

`gold` is the keyboard-focus outline. `final-button` is the warmer closing CTA fill. Gold is restrained rather than used as the principal homepage background.

### Neutral

White is the resource background and signup-card surface. `ink` is the default text customization value; muted blue-gray text supports descriptions. Input and section borders remain light and quiet.

**The Home Scope Rule.** Apply this blue-and-lilac composition only inside the homepage root. Preserve the existing chat identity and all unrelated page styles.

## Typography

The observed stack is Inter with Segoe UI and sans-serif fallbacks. Headlines use medium-heavy weight, compact leading, and slightly negative tracking. Section headings remain smaller than the hero context rather than occupying entire screens.

The normative display and headline roles appear in the frontmatter. The signup title uses the title role. Hero copy uses the hero-body role; resource prose is generally (16px), while FAQ answers are (15px) with (1.7) leading. Hero copy is limited to approximately (430px). Navigation is (14px) and weight (600). Mobile overrides the hero headline to (31px), hero prose to (15px), and common action labels to (14px).

## Layout

The desktop header and hero have a maximum width of (1280px). The hero grid divides copy and image space (43% / 57%), with a minimum height of (705px), left inset of (80px), and a copy measure of (455px). The signup card is at most (365px) wide. The transparent professional image sits against the hero's lower edge and occupies the right side without a rectangular photo background.

Resource sections use a maximum width of (1160px) and the section spacing tokens. Comparison content has an (820px) maximum width; resource previews and copy form a two-column grid. Categories use two columns of text links. The audience section combines copy with an event-setting photo. The FAQ section narrows to (960px). The footer starts with four columns.

At (1100px), navigation gaps and hero offsets tighten. At (850px), the navigation becomes a hamburger-controlled panel and the hero stacks copy, email card, and professionals vertically. At (600px), workflow, resource, category, audience, and mobile-access sections become single-column; section spacing uses the mobile tokens. The footer becomes two columns with the brand spanning the row. Preserve the current content order on mobile.

## Elevation & Depth

Depth is concentrated in a few intentional objects: overlapping lilac echoes behind the white signup card, a soft shadow around the illustrative resource preview, and an offset pale-lilac backing behind the phone-shaped access preview. Most resource content stays on flat white surfaces with dividers.

The signup echo is `8px -9px 0 #aba0f46b, 16px -18px 0 #aba0f433`; mobile uses `6px -7px 0 #aba0f46b, 12px -14px 0 #aba0f433`. The demo shadow is `0 18px 45px #173d8120`. The phone preview uses `15px 20px 0 #ece5fc`.

## Shapes

Primary actions are pills. Inputs have small rounded corners; resource preview cards have softer corners. The white signup card has an asymmetric lower-right corner (`24px 24px 0 24px`, mobile `20px 20px 0 20px`). Circular numbers and thin vertical connectors organize comparison steps. The phone-shaped preview has a thick navy border and (38px) corners. Hero geometry is decorative, clipped, and noninteractive.

## Components

### Buttons

Primary buttons use the normative frontmatter tokens and a minimum height of (52px), reduced to (48px) on mobile. Hover applies `filter: brightness(.92)`. Links and buttons retain a visible gold outline (3px) with an offset (4px) on keyboard focus. The final action uses the warm closing variant.

### Inputs / Fields

The email field has a light border, white background, and (16px) input text. It uses a real email input, autocomplete, a screen-reader label, required validation, and a maximum length of (254). Submission saves the trimmed email locally when possible and routes to `/entrar?mode=signup` to finish registration; the card does not itself create an account.

### Navigation

The desktop nav is white on the blue hero and uses underlined hover feedback. Signup is an outlined pill. The mobile hamburger exposes its expanded state, controls the navigation panel, changes to a close icon, and closes after a navigation click.

### Comparison and Resource Controls

Comparison is a pill-shaped two-button switch with `aria-pressed`; its content updates in a polite live region. Resource controls are three buttons with `aria-pressed` and a blue underline for selection. They switch descriptive content and the illustrative resource preview. They are buttons, rather than an implemented ARIA tab system.

### Cards / Containers

The workflow panel is pale lilac with centered branding. The demo has a navy top bar, white rows, compact lilac status tags, and a pale footer. It must remain visibly labeled “Prévia ilustrativa”; its rows are illustrative, not account data. The phone-shaped preview contains working navigation links and represents mobile access rather than a downloadable native application.

### FAQs

FAQs use native `details` and `summary` elements, quiet horizontal separators, and a plus icon that rotates when expanded. Answers distinguish public supplier contacts from the separate paid-credit Chat LOSI and explain that resource availability depends on the feature and plan.

### Motion

Action hover transitions last (.15s). The resource preview has a short (.3s) vertical entrance animation only when reduced motion is not requested. Decorative visuals do not interrupt content or require interaction.

## Do's and Don'ts

### Do:

- Do keep homepage rules scoped to the homepage root and its existing components.
- Do preserve the left copy/email card and right transparent event-professional composition on desktop.
- Do preserve stacked content and accessible hamburger navigation on mobile.
- Do mark the resource demonstration as “Prévia ilustrativa”.
- Do describe only the capabilities supported by the existing source and keep feature and plan conditions visible.

### Don't:

- Don't apply this homepage palette to the chat or unrelated pages.
- Don't replace the professionals with financial-service imagery or an Asaas logo.
- Don't imply that signup alone activates every feature or that the preview shows a user's live data.
- Don't remove labels, native FAQ controls, selected states, or keyboard-focus visibility.
