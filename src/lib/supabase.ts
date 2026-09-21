import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://bpvaftobiosjesdbaany.supabase.co";

const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabasePublishableKey) {
  throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY não configurada.");
}

// No desenvolvimento local, o navegador pode usar 127.0.0.1, localhost
// ou uma URL encaminhada pelo ambiente de desenvolvimento. O proxy do Vite
// mantém as chamadas ao Supabase same-origin e evita falhas de CORS locais.
// Em produção, as chamadas continuam indo diretamente ao Supabase.
const localSupabaseFetch: typeof fetch = (input, init) => {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return fetch(input, init);
  }

  const requestUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (!requestUrl.startsWith(supabaseUrl)) {
    return fetch(input, init);
  }

  const remoteUrl = new URL(requestUrl);
  const proxiedUrl =
    window.location.origin + "/__supabase" +
    remoteUrl.pathname + remoteUrl.search;

  return fetch(proxiedUrl, init);
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: {
    fetch: localSupabaseFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
