import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://bpvaftobiosjesdbaany.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EsH6rhQ7pJ0SP6dM9_tILA_KO7MShd1";

const configuredUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const configuredKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ""
).trim();

const supabaseUrl =
  configuredUrl === DEFAULT_SUPABASE_URL ? configuredUrl : DEFAULT_SUPABASE_URL;

const supabasePublishableKey =
  configuredKey.startsWith("sb_publishable_") || configuredKey.startsWith("eyJ")
    ? configuredKey
    : DEFAULT_SUPABASE_PUBLISHABLE_KEY;

if (!supabasePublishableKey) {
  throw new Error("Supabase não configurado.");
}

if (supabasePublishableKey.startsWith("sb_secret_")) {
  throw new Error("Configuração inválida: uma chave secreta não pode ser usada no navegador.");
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
