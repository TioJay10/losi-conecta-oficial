const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const j = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: H });
const phone = (value: unknown) => { let n = String(value || "").replace(/\D/g, ""); if (n.length === 10 || n.length === 11) n = "55" + n; return n; };
const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
const columns = "id,losi_id,full_name,professional_name,whatsapp,whatsapp_normalized,city,state,photo_url,calendar_token";
const result = (p: any) => ({ found: true, calendarToken: p.calendar_token, profile: { losi_id: p.losi_id, display_name: p.professional_name || p.full_name, city: p.city, state: p.state, photo_url: p.photo_url, whatsapp_masked: "•••• ••••-" + phone(p.whatsapp).slice(-4) } });
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: H });
  if (request.method !== "POST") return j({ error: "Método não permitido." }, 405);
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await request.json();
    const n = phone(body.whatsapp), name = String(body.name || "").trim();
    const id = String(body.losiId || "").trim().toUpperCase();
    if (body.action === "register") {
      if (!name || name.length > 160 || !/^55\d{10,11}$/.test(n)) return j({ error: "Informe nome completo e WhatsApp válido com DDD." }, 400);
      const existing = await client.from("collaborator_profiles").select("id").eq("whatsapp_normalized", n).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return j({ error: "Este WhatsApp já tem um ID. Use ‘Já tenho ID’ ou ‘Esqueci meu ID’." }, 409);
      for (let attempt = 0; attempt < 5; attempt++) {
        const bytes = new Uint32Array(1); crypto.getRandomValues(bytes);
        const created = await client.from("collaborator_profiles").insert({
          losi_id: "LOSI-" + String(bytes[0] % 1000000).padStart(6, "0"), full_name: name,
          professional_name: String(body.professionalName || "").trim().slice(0, 160) || null,
          whatsapp: String(body.whatsapp || "").trim(), whatsapp_normalized: n,
          city: String(body.city || "").trim().slice(0, 120) || null, state: String(body.state || "").trim().toUpperCase().slice(0, 2) || null,
        }).select(columns).single();
        if (!created.error) return j({ ...result(created.data), created: true });
        if (created.error.code !== "23505") throw created.error;
        const duplicate = await client.from("collaborator_profiles").select("id").eq("whatsapp_normalized", n).maybeSingle();
        if (duplicate.error) throw duplicate.error;
        if (duplicate.data) return j({ error: "Este WhatsApp já tem um ID. Use ‘Já tenho ID’ ou ‘Esqueci meu ID’." }, 409);
      }
      return j({ error: "Não foi possível gerar seu ID. Tente novamente." }, 500);
    }
    if (body.action === "recover") {
      if (!name || !/^55\d{10,11}$/.test(n)) return j({ error: "Informe nome completo ou nome de tio e WhatsApp com DDD." }, 400);
      const { data: p, error } = await client.from("collaborator_profiles").select(columns).eq("whatsapp_normalized", n).maybeSingle();
      if (error) throw error;
      if (!p || ![p.full_name, p.professional_name].some(value => value && norm(value) === norm(name))) return j({ error: "Não encontramos um colaborador com esse nome e WhatsApp." }, 404);
      return j(result(p));
    }
    if (!/^LOSI-\d{6}$/.test(id)) return j({ error: "Informe um ID LOSI válido." }, 400);
    const { data: p, error } = await client.from("collaborator_profiles").select(columns).eq("losi_id", id).maybeSingle();
    if (error) throw error;
    // ID identifies; registered WhatsApp or the personal link authorizes access.
    if (!p || !(String(body.calendarToken || "") === p.calendar_token || (n && n === p.whatsapp_normalized))) return j({ error: "ID e WhatsApp não correspondem. Confira os dados ou use ‘Esqueci meu ID’." }, 403);
    return j(result(p));
  } catch (error) {
    console.error(error);
    return j({ error: "Não foi possível acessar seu calendário. Tente novamente." }, 500);
  }
});
