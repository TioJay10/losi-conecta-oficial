# LOSI content generation

First release: existing /propostas editor plus an expandable "Propostas e materiais com IA" workspace.
The OpenAI API supplies text only. Existing proposal PDF code is unchanged.
Materials have a separate plain-text editor, private cloud history and local jsPDF export.
Manual writing, save, editing and download do not call OpenAI.

## Activation

Deploy migration 20261005021108_add_losi_ai_content_quota_and_materials.sql and Edge Function losi-ai-content.
The deployed project is bpvaftobiosjesdbaany.
Set OPENAI_API_KEY in Supabase Dashboard > Edge Functions > Secrets.
Use a dedicated OpenAI project key with its own budget and monitor actual usage.
Never use a VITE_ variable for this key, commit it, or paste it into chat.
With no key, status reports configured=false and generation is disabled.
For local frontend development, run npm run dev: the existing /__supabase proxy connects to the same authenticated backend.

The fixed initial model is gpt-4.1-mini-2025-04-14.
POST /v1/chat/completions uses strict structured JSON output, store=false and a 90-second timeout.
Output budgets adapt to validated depth and page references (1–8), capped server-side at 9,000 tokens. Page counts in instructions override the selector. Counts are approximate writing references, not guaranteed PDF pagination. Plain-text sections follow the requested topic, audience and requirements without filler. Context strings are limited to 2,000 characters each. One provider call and one quota unit per completed draft; no automatic paid retries. The LIA proposal workspace offers depth/length controls and does not restore the removed material editor.
No web searches, image generation or external tools are enabled.

## Access

Existing commercial plans and billing are unchanged. The current Destaque price is R$59.00, not R$50.
The Pro plan has NOT been put up for sale; payment creation currently only supports profissional/destaque.
Admins can test the feature with the same monthly caps.
A pilot can be granted server-side through losi_ai_access (user_id, starts_at, ends_at).
Only service_role can change access and usage.
Future active subscriptions with the exact slug pro are recognized, but adding billing support and inherited Destaque benefits is a separate rollout.
Do not advertise Pro before testing with a real key and completing its checkout/benefits.

Default allowance: 4 proposal and 5 material generations per billing cycle.
Granted access renews its counts monthly from starts_at until ends_at.
Admin preview resets on the UTC calendar month.
A completed draft consumes an allowance even if discarded; failures release the reserved allowance.
No extra-credit sales or transferable credits are included in this release.

## Controls and privacy

Database reservation is atomic, service-only and protected against parallel requests.
Request UUIDs prevent a completed request from being charged again.
One active request per user; stale reservations expire after 5 minutes.
30 attempts/user/hour; 3,000 attempts/platform/UTC month, including failures.
The platform cap is an attempt cap, not an exact money budget.
Generation tables expose only owner SELECT; materials have owner-only CRUD through RLS.
Client-supplied plan/model/limits are not trusted.
Context is whitelisted: contact fields and fiscal documents are not sent to OpenAI.
Avoid including sensitive information in free-text instructions.
Generated content is always a draft and does not execute financial or operational actions.
Auth failures, plan restrictions, quotas and provider errors are shown in the UI.

## Validation

npm run build
node tests/losi-ai-content.cjs

Provider tests cover no-key, no-access, exhausted allowance, invalid instructions,
cached requests, structured output and output limits, failed provider calls,
truncated/malformed output and persistence failure.
Transaction tests against Supabase verify independent quotas, duplicate request IDs,
failure releases, owner-only materials, blocked user reassignment and blocked client quota updates; test writes are rolled back.
No real OpenAI generation or charging has been performed.
A real key test should verify Portuguese content quality, refusal handling, cost and PDF readability before sales.
Browser screenshots were not available in the execution environment; mobile behavior has been reviewed in CSS but not verified visually.
