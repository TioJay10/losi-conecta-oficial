import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ??
  "https://bpvaftobiosjesdbaany.supabase.co"
).trim();

const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ""
).trim();

if (!supabasePublishableKey) {
  throw new Error("Supabase não configurado: defina VITE_SUPABASE_PUBLISHABLE_KEY no ambiente de build.");
}

if (supabasePublishableKey.startsWith("sb_secret_")) {
  throw new Error("Configuração inválida: VITE_SUPABASE_PUBLISHABLE_KEY não pode receber uma chave secreta.");
}

const localSupabaseFetch: typeof fetch = (input, init) => {
  if (!import.meta.env.DEV || typeof window === "undefined") return fetch(input, init);

  const requestUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (!requestUrl.startsWith(supabaseUrl)) return fetch(input, init);

  const remoteUrl = new URL(requestUrl);
  const proxiedUrl =
    window.location.origin + "/__supabase" + remoteUrl.pathname + remoteUrl.search;

  return fetch(proxiedUrl, init);
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: { fetch: localSupabaseFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
