import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
const checked = (r: any) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const types = [
  "text",
  "textarea",
  "phone",
  "email",
  "date",
  "number",
  "select",
  "multi",
];
function definition(b: any) {
  if (
    typeof b.title !== "string" ||
    !b.title.trim() ||
    b.title.trim().length > 160 ||
    typeof b.description !== "string" ||
    b.description.length > 3000 ||
    !["public", "suppliers", "both"].includes(b.audience) ||
    !["draft", "open", "closed"].includes(b.status) ||
    typeof b.notify !== "boolean" ||
    !Array.isArray(b.fields) ||
    b.fields.length < 1 ||
    b.fields.length > 40
  )
    throw new Error("FORM_INVALID");
  const ids = new Set<string>();
  const fields = b.fields.map((f: any) => {
    if (
      !f ||
      typeof f.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,60}$/.test(f.id) ||
      ids.has(f.id) ||
      typeof f.label !== "string" ||
      !f.label.trim() ||
      f.label.length > 200 ||
      !types.includes(f.type) ||
      typeof f.required !== "boolean"
    )
      throw new Error("FORM_INVALID");
    ids.add(f.id);
    const options = ["select", "multi"].includes(f.type) ? f.options : [];
    if (
      !Array.isArray(options) ||
      (["select", "multi"].includes(f.type) &&
        (options.length < 1 || options.length > 30)) ||
      options.some(
        (v: any) => typeof v !== "string" || !v.trim() || v.length > 100,
      ) ||
      new Set(options).size !== options.length
    )
      throw new Error("FORM_OPTIONS");
    return {
      id: f.id,
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      options,
    };
  });
  return {
    title: b.title.trim(),
    description: b.description.trim(),
    template: typeof b.template === "string" ? b.template.slice(0, 60) : "free",
    fields,
    audience: b.audience,
    status: b.status,
    notify: b.notify,
  };
}
export function validateAnswers(fields: any[], raw: any) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("FORM_ANSWERS");
  const answers: Record<string, string | string[]> = {};
  for (const f of fields) {
    const value = raw[f.id] ?? (f.type === "multi" ? [] : "");
    if (f.type === "multi") {
      if (
        !Array.isArray(value) ||
        value.length > 30 ||
        value.some((v) => typeof v !== "string" || !f.options.includes(v)) ||
        new Set(value).size !== value.length ||
        (f.required && !value.length)
      )
        throw new Error("FORM_ANSWERS");
      answers[f.id] = value;
      continue;
    }
    if (
      typeof value !== "string" ||
      value.length > (f.type === "textarea" ? 6000 : 1000) ||
      (f.required && !value.trim())
    )
      throw new Error("FORM_ANSWERS");
    const v = value.trim();
    if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      throw new Error("FORM_ANSWERS");
    if (v && f.type === "phone" && !/^\+?[\d\s().-]{8,30}$/.test(v))
      throw new Error("FORM_ANSWERS");
    if (
      v &&
      f.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        !Number.isFinite(Date.parse(v)) ||
        new Date(v).toISOString().slice(0, 10) !== v)
    )
      throw new Error("FORM_ANSWERS");
    if (
      v &&
      f.type === "number" &&
      (!/^-?\d+(\.\d+)?$/.test(v) || !Number.isFinite(Number(v)))
    )
      throw new Error("FORM_ANSWERS");
    if (v && f.type === "select" && !f.options.includes(v))
      throw new Error("FORM_ANSWERS");
    answers[f.id] = v;
  }
  return answers;
}
const messages: Record<string, string> = {
  FORM_UNAVAILABLE: "Este formulário está encerrado ou não está disponível.",
  FORM_CHANGED:
    "O formulário foi atualizado. Recarregue a página antes de enviar.",
  FORM_LOGIN_REQUIRED:
    "Este formulário é exclusivo para fornecedores convidados. Entre na sua conta LOSI.",
  FORM_INVITATION_REQUIRED: "Este formulário não foi enviado para sua conta.",
  FORM_ALREADY_SENT: "Você já respondeu a este formulário.",
  FORM_RATE_LIMIT:
    "Muitas respostas em pouco tempo. Tente novamente mais tarde.",
  FORM_INVALID: "Revise o título e as perguntas do formulário.",
  FORM_OPTIONS:
    "Adicione opções diferentes e preenchidas às perguntas de seleção.",
  FORM_ANSWERS: "Revise os campos obrigatórios e o formato das respostas.",
  FORM_CONFLICT: "O formulário mudou em outra aba. Reabra-o antes de salvar.",
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  try {
    const text = await req.text();
    if (text.length > 180000)
      return json({ error: "Formulário muito grande." }, 413);
    const b = JSON.parse(text);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const safeForm = async (f: any) => {
      const business = checked(
        await admin
          .from("business_profiles")
          .select("business_name,active,owner_id")
          .eq("owner_id", f.owner_id)
          .maybeSingle(),
      );
      const profile = checked(
        await admin
          .from("profiles")
          .select("blocked")
          .eq("id", f.owner_id)
          .maybeSingle(),
      );
      if (!business?.active || profile?.blocked)
        throw new Error("FORM_UNAVAILABLE");
      return {
        id: f.id,
        public_token: f.public_token,
        title: f.title,
        description: f.description,
        fields: f.fields,
        version: f.version,
        audience: f.audience,
        business_name: business.business_name,
      };
    };
    const byToken = async () => {
      if (!uuid(b.token)) throw new Error("FORM_UNAVAILABLE");
      const f = checked(
        await admin
          .from("losi_forms")
          .select("*")
          .eq("public_token", b.token)
          .maybeSingle(),
      );
      if (!f || f.status !== "open") throw new Error("FORM_UNAVAILABLE");
      return f;
    };
    if (b.action === "public-get") {
      const f = await byToken();
      return json({ form: await safeForm(f) });
    }
    if (b.action === "public-submit") {
      if (b.website) return json({ error: "Não foi possível enviar." }, 400);
      const f = await byToken();
      await safeForm(f);
      if (!["public", "both"].includes(f.audience))
        throw new Error("FORM_LOGIN_REQUIRED");
      if (
        !uuid(b.requestId) ||
        !Number.isInteger(b.version) ||
        typeof b.name !== "string" ||
        !b.name.trim() ||
        b.name.length > 200
      )
        throw new Error("FORM_ANSWERS");
      const answers = validateAnswers(f.fields, b.answers);
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";
      const bytes = new TextEncoder().encode(
        ip + ":" + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      );
      const hash = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      const id = checked(
        await admin.rpc("losi_forms_submit", {
          p_token: f.public_token,
          p_version: b.version,
          p_request: b.requestId,
          p_name: b.name.trim(),
          p_answers: answers,
          p_ip: hash,
        }),
      );
      return json({ id });
    }
    const bearer = (req.headers.get("Authorization") ?? "").replace(
      /^Bearer\s+/i,
      "",
    );
    const { data: auth, error } = await admin.auth.getUser(bearer);
    if (error || !auth.user)
      return json({ error: "Entre na sua conta LOSI para continuar." }, 401);
    const user = auth.user;
    const profile = checked(
      await admin
        .from("profiles")
        .select("blocked,full_name")
        .eq("id", user.id)
        .maybeSingle(),
    );
    if (profile?.blocked)
      return json({ error: "Sua conta está indisponível." }, 403);
    const ownBusiness = checked(
      await admin
        .from("business_profiles")
        .select("id,business_name,active")
        .eq("owner_id", user.id)
        .maybeSingle(),
    );
    if (!ownBusiness?.active)
      return json(
        {
          error: "Complete os dados de Minha empresa para usar os formulários.",
        },
        403,
      );
    const owned = async () => {
      if (!uuid(b.id)) throw new Error("FORM_UNAVAILABLE");
      const f = checked(
        await admin
          .from("losi_forms")
          .select("*")
          .eq("id", b.id)
          .eq("owner_id", user.id)
          .maybeSingle(),
      );
      if (!f) throw new Error("FORM_UNAVAILABLE");
      return f;
    };
    if (b.action === "list") {
      const forms = checked(
        await admin
          .from("losi_forms")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
      );
      return json({ forms, business_name: ownBusiness.business_name });
    }
    if (b.action === "save") {
      const values = definition(b.form);
      if (b.id) {
        const f = await owned();
        if (f.version !== b.version) throw new Error("FORM_CONFLICT");
        const saved = checked(
          await admin
            .from("losi_forms")
            .update({
              ...values,
              version: f.version + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", f.id)
            .eq("owner_id", user.id)
            .eq("version", b.version)
            .select("*")
            .maybeSingle(),
        );
        if (!saved) throw new Error("FORM_CONFLICT");
        return json({ form: saved });
      }
      const { count, error: countError } = await admin
        .from("losi_forms")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);
      if (countError) throw countError;
      if ((count ?? 0) >= 200)
        return json(
          {
            error:
              "Você atingiu o limite de 200 formulários. Exclua os que não utiliza.",
          },
          400,
        );
      return json({
        form: checked(
          await admin
            .from("losi_forms")
            .insert({ ...values, owner_id: user.id })
            .select("*")
            .single(),
        ),
      });
    }
    if (b.action === "delete") {
      const f = await owned();
      checked(
        await admin
          .from("losi_forms")
          .delete()
          .eq("id", f.id)
          .eq("owner_id", user.id),
      );
      return json({ ok: true });
    }
    if (b.action === "responses") {
      await owned();
      const page = Number.isInteger(b.page)
        ? Math.max(0, Math.min(10000, b.page))
        : 0;
      let query = admin
        .from("losi_form_responses")
        .select(
          "id,form_id,respondent_id,respondent_name,source,answers,definition,status,created_at",
          { count: "exact" },
        )
        .eq("form_id", b.id)
        .order("created_at", { ascending: false });
      if (["public", "supplier"].includes(b.source))
        query = query.eq("source", b.source);
      if (["new", "review", "approved", "archived"].includes(b.status))
        query = query.eq("status", b.status);
      if (typeof b.search === "string" && b.search.trim())
        query = query.ilike(
          "respondent_name",
          "%" +
            b.search
              .trim()
              .slice(0, 100)
              .replace(/[%_\\]/g, "") +
            "%",
        );
      if (typeof b.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.from))
        query = query.gte("created_at", b.from + "T00:00:00-03:00");
      if (typeof b.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.until))
        query = query.lte("created_at", b.until + "T23:59:59.999-03:00");
      const r = await query.range(page * 30, page * 30 + 29);
      if (r.error) throw r.error;
      return json({ responses: r.data, count: r.count });
    }
    if (b.action === "response-status" || b.action === "response-delete") {
      await owned();
      if (!uuid(b.responseId)) throw new Error("FORM_UNAVAILABLE");
      if (b.action === "response-delete") {
        checked(
          await admin
            .from("losi_form_responses")
            .delete()
            .eq("id", b.responseId)
            .eq("form_id", b.id),
        );
        return json({ ok: true });
      }
      if (!["new", "review", "approved", "archived"].includes(b.status))
        throw new Error("FORM_INVALID");
      checked(
        await admin
          .from("losi_form_responses")
          .update({ status: b.status })
          .eq("id", b.responseId)
          .eq("form_id", b.id),
      );
      return json({ ok: true });
    }
    if (b.action === "invite") {
      const f = await owned();
      if (f.status !== "open" || !["suppliers", "both"].includes(f.audience))
        return json(
          {
            error:
              "Publique o formulário e habilite Fornecedores LOSI antes de convidar.",
          },
          400,
        );
      if (typeof b.slug !== "string" || !/^[\w-]{1,200}$/.test(b.slug))
        return json({ error: "Cole um link válido de perfil público." }, 400);
      const target = checked(
        await admin
          .from("business_profiles")
          .select("owner_id,business_name")
          .eq("slug", b.slug)
          .eq("active", true)
          .eq("approval_status", "approved")
          .maybeSingle(),
      );
      if (!target || target.owner_id === user.id)
        return json(
          { error: "Fornecedor não encontrado ou pertencente à sua conta." },
          400,
        );
      const invited = await admin
        .from("losi_form_invitations")
        .insert({ form_id: f.id, recipient_id: target.owner_id });
      if (invited.error?.code === "23505")
        return json({ error: "Este fornecedor já recebeu o formulário." }, 400);
      checked(invited);
      checked(
        await admin
          .from("notifications")
          .insert({
            user_id: target.owner_id,
            type: "form_invitation",
            title: "Formulário recebido",
            message: ownBusiness.business_name + " enviou: " + f.title,
            link: "/formularios",
          }),
      );
      return json({ name: target.business_name });
    }
    if (b.action === "inbox") {
      const invites = checked(
        await admin
          .from("losi_form_invitations")
          .select("id,form_id,created_at")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
      );
      if (!invites.length) return json({ invitations: [] });
      const ids = invites.map((i: any) => i.form_id);
      const forms = checked(
        await admin
          .from("losi_forms")
          .select("id,title,public_token,owner_id,status,audience")
          .in("id", ids),
      );
      const replies = checked(
        await admin
          .from("losi_form_responses")
          .select("form_id")
          .eq("respondent_id", user.id)
          .in("form_id", ids),
      );
      const owners = [...new Set(forms.map((f: any) => f.owner_id))];
      const businesses = owners.length
        ? checked(
            await admin
              .from("business_profiles")
              .select("owner_id,business_name")
              .in("owner_id", owners),
          )
        : [];
      return json({
        invitations: invites
          .map((i: any) => {
            const f = forms.find((f: any) => f.id === i.form_id);
            return {
              ...i,
              form: f,
              company: businesses.find((x: any) => x.owner_id === f?.owner_id)
                ?.business_name,
              answered: replies.some((r: any) => r.form_id === i.form_id),
            };
          })
          .filter((i: any) => i.form),
      });
    }
    if (b.action === "supplier-get" || b.action === "supplier-submit") {
      const f = await byToken();
      if (!["suppliers", "both"].includes(f.audience))
        throw new Error("FORM_INVITATION_REQUIRED");
      const invite = checked(
        await admin
          .from("losi_form_invitations")
          .select("id")
          .eq("form_id", f.id)
          .eq("recipient_id", user.id)
          .maybeSingle(),
      );
      if (!invite) throw new Error("FORM_INVITATION_REQUIRED");
      const already = checked(
        await admin
          .from("losi_form_responses")
          .select("id")
          .eq("form_id", f.id)
          .eq("respondent_id", user.id)
          .maybeSingle(),
      );
      if (b.action === "supplier-get")
        return json({
          form: await safeForm(f),
          answered: !!already,
          name: profile?.full_name || ownBusiness.business_name,
        });
      if (
        !uuid(b.requestId) ||
        !Number.isInteger(b.version) ||
        typeof b.name !== "string" ||
        !b.name.trim() ||
        b.name.length > 200
      )
        throw new Error("FORM_ANSWERS");
      const answers = validateAnswers(f.fields, b.answers);
      const id = checked(
        await admin.rpc("losi_forms_submit", {
          p_token: f.public_token,
          p_version: b.version,
          p_request: b.requestId,
          p_name: b.name.trim(),
          p_answers: answers,
          p_ip: "supplier:" + user.id,
          p_user: user.id,
        }),
      );
      return json({ id });
    }
    return json({ error: "Ação não disponível." }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return json(
      {
        error:
          messages[message] ||
          "Não foi possível concluir agora. Tente novamente.",
      },
      400,
    );
  }
});
