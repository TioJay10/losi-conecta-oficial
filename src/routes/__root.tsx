import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import "../responsive.css";
import "../montserrat.css";
import "../panel-header-contrast.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LOSI CONECTA" },
      {
        name: "description",
        content: "Encontre fornecedores e profissionais para seu evento.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "https://bpvaftobiosjesdbaany.supabase.co/storage/v1/object/public/provider-media/628003ac-1ed5-4e25-a725-b12b742f9bde/logo-53aa0fd9-1cec-4321-912d-8c8903e71a53.png",
        type: "image/png",
      },
      {
        rel: "apple-touch-icon",
        href: "https://bpvaftobiosjesdbaany.supabase.co/storage/v1/object/public/provider-media/628003ac-1ed5-4e25-a725-b12b742f9bde/logo-53aa0fd9-1cec-4321-912d-8c8903e71a53.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const existing = document.querySelector('script[data-losi-vlibras="true"]');
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.async = true;
    script.dataset.losiVlibras = "true";
    document.body.appendChild(script);
  }, []);

  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body style={{ margin: 0 }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function GlobalNotificationAlerts({ isAuthenticated, currentPath }: { isAuthenticated: boolean; currentPath: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSoundUrlRef = useRef<string | null>(null);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      knownNotificationIdsRef.current.clear();
      activeSoundUrlRef.current = null;
      audioRef.current?.pause();
      audioRef.current = null;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setToastVisible(false);
      return;
    }

    let mounted = true;
    let channel: any = null;
    let soundChannel: any = null;
    let pollTimer: number | null = null;

    async function loadActiveSound() {
      const { supabase } = await import("../lib/supabase");
      const { data, error } = await supabase
        .from("notification_sounds")
        .select("public_url")
        .eq("active", true)
        .maybeSingle();

      if (!mounted) return;

      const url = error || !data?.public_url ? null : data.public_url;
      activeSoundUrlRef.current = url;

      if (!url) {
        audioRef.current?.pause();
        return;
      }

      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audioRef.current = audio;
      }

      if (audio.src !== url) {
        audio.src = url;
        audio.preload = "auto";
        audio.load();
      }
      audio.volume = 0.35;
    }

    async function unlockAudio() {
      if (!audioRef.current || !activeSoundUrlRef.current) {
        await loadActiveSound();
      }

      const audio = audioRef.current;
      if (!audio) return;

      try {
        audio.muted = true;
        audio.volume = 0;
        audio.currentTime = 0;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audio.volume = 0.35;
      } catch {
        audio.muted = false;
        audio.volume = 0.35;
      }
    }

    async function playNotificationSound() {
      const audio = audioRef.current;
      const url = activeSoundUrlRef.current;
      if (!audio || !url || audio.src !== url) return;

      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 0.35;

      try {
        // O áudio já está carregado/pré-carregado; aqui não há consulta ao banco.
        await audio.play();
      } catch (error) {
        console.warn("O navegador bloqueou o som da notificação:", error);
      }
    }

    function showToast() {
      if (currentPath === "/painel") return;
      setToastVisible(true);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        if (mounted) setToastVisible(false);
      }, 5000);
    }

    async function processNewNotification(notification: { id: string; read_at: string | null }) {
      if (!mounted || knownNotificationIdsRef.current.has(notification.id)) return;
      knownNotificationIdsRef.current.add(notification.id);
      if (notification.read_at) return;

      // Dispara som e aviso no mesmo evento que recebe a notificação.
      await Promise.all([playNotificationSound(), Promise.resolve(showToast())]);
    }

    async function start() {
      const { supabase } = await import("../lib/supabase");
      const { data: userData } = await supabase.auth.getUser();
      if (!mounted || !userData.user) return;

      await loadActiveSound();
      if (!mounted) return;

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userData.user.id);

      (existing ?? []).forEach((row) => knownNotificationIdsRef.current.add(row.id));

      channel = supabase
        .channel("global-notifications-" + userData.user.id + "-" + Date.now())
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: "user_id=eq." + userData.user.id,
          },
          (payload) => {
            void processNewNotification(payload.new as { id: string; read_at: string | null });
          },
        )
        .subscribe();

      soundChannel = supabase
        .channel("global-notification-sound-" + userData.user.id + "-" + Date.now())
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notification_sounds",
          },
          () => {
            void loadActiveSound();
          },
        )
        .subscribe();

      pollTimer = window.setInterval(async () => {
        if (document.visibilityState !== "visible") return;

        const { data } = await supabase
          .from("notifications")
          .select("id,read_at")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        for (const notification of data ?? []) {
          if (!knownNotificationIdsRef.current.has(notification.id)) {
            await processNewNotification(notification);
          }
        }
      }, 5000);
    }

    const handlePointerDown = () => void unlockAudio();
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    void start();

    return () => {
      mounted = false;
      window.removeEventListener("pointerdown", handlePointerDown);
      if (pollTimer) window.clearInterval(pollTimer);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (channel) void import("../lib/supabase").then(({ supabase }) => supabase.removeChannel(channel));
      if (soundChannel) void import("../lib/supabase").then(({ supabase }) => supabase.removeChannel(soundChannel));
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [isAuthenticated, currentPath]);

  useEffect(() => {
    if (currentPath === "/painel") {
      setToastVisible(false);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    }
  }, [currentPath]);

  if (!toastVisible || currentPath === "/painel") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        width: "min(calc(100vw - 28px), 360px)",
        boxSizing: "border-box",
        padding: "11px 16px",
        borderRadius: 12,
        background: "#12233a",
        border: "1px solid rgba(212,175,55,.55)",
        boxShadow: "0 10px 30px rgba(0,0,0,.24)",
        color: "#fff",
        fontFamily: "Montserrat, Arial, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      Você tem uma nova notificação.
    </div>
  );
}

function RootComponent() {
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const sessionCheck = import("../lib/supabase")
      .then(({ supabase }) => supabase.auth.getSession());

    Promise.race([
      sessionCheck,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10000)),
    ])
      .then((result) => {
        if (!mounted) return;
        setIsAuthenticated(Boolean(result && "data" in result ? result.data.session : null));
        setAuthChecked(true);
      })
      .catch(() => {
        if (!mounted) return;
        setIsAuthenticated(false);
        setAuthChecked(true);
      });

    let unsubscribe = () => {};
    import("../lib/supabase").then(({ supabase }) => {
      if (!mounted) return;
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setIsAuthenticated(Boolean(session));
        setAuthChecked(true);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    }).catch(() => {});

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const publicRoute =
    location.pathname === "/" ||
    location.pathname === "/entrar" ||
    location.pathname === "/buscar" ||
    location.pathname.startsWith("/fornecedor/");

  if (!authChecked && !publicRoute) {
    return (
      <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,boxSizing:"border-box",background:"linear-gradient(145deg,#0b1626,#142238)",color:"#fff",fontFamily:"Montserrat,Arial,sans-serif"}}>
        <section style={{width:"min(100%,560px)",boxSizing:"border-box",padding:"42px 34px",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,background:"rgba(18,31,50,.96)",boxShadow:"0 24px 70px rgba(0,0,0,.3)",textAlign:"center"}}>
          <strong style={{color:"#d6b15b",letterSpacing:".12em",fontSize:13}}>LOSI CONECTA</strong>
          <h1 style={{margin:"14px 0 10px"}}>Verificando seu acesso...</h1>
          <p style={{margin:"0 auto 26px",maxWidth:460,color:"#c4cedb",lineHeight:1.65}}>Aguarde enquanto confirmamos sua sessão.</p>
        </section>
      </main>
    );
  }

  if (!publicRoute && !isAuthenticated) {
    return (
      <main className="auth-required-page">
        <section className="auth-required-card">
          <div className="auth-required-kicker">ACESSO RESTRITO</div>
          <h1>Você precisa estar logado</h1>
          <p>Para visualizar fornecedores, perfis, serviços e utilizar as funções do LOSI CONECTA, entre na sua conta.</p>
          <a className="auth-required-button" href="/entrar">Entrar na minha conta</a>
        </section>
      </main>
    );
  }

  return (
    <>
      <GlobalNotificationAlerts isAuthenticated={isAuthenticated} currentPath={location.pathname} />
      <main className="losi-page-transition">
        <Outlet />
      </main>
    </>
  );
}

function RootErrorComponent() {
  const recover = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_refresh", String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f7f8fc",
        color: "#172033",
        fontFamily: "\"Montserrat\", Arial, sans-serif",
        textAlign: "center",
      }}
    >
      <section style={{ maxWidth: 520 }}>
        <strong style={{ color: "#4f46c7", letterSpacing: ".08em" }}>LOSI CONECTA</strong>
        <h1 style={{ margin: "14px 0 8px" }}>Não foi possível carregar esta página.</h1>
        <p style={{ color: "#687386", lineHeight: 1.6 }}>
          Ocorreu um erro inesperado. Tente carregar novamente.
        </p>
        <button
          type="button"
          onClick={recover}
          style={{
            border: 0,
            borderRadius: 10,
            padding: "12px 18px",
            background: "#4f46c7",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

function NotFoundComponent() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f7f8fc",
        color: "#172033",
        fontFamily: "\"Montserrat\", Arial, sans-serif",
        textAlign: "center",
      }}
    >
      <section>
        <strong style={{ color: "#4f46c7", letterSpacing: ".08em" }}>LOSI CONECTA</strong>
        <h1 style={{ margin: "14px 0 8px" }}>Página não encontrada.</h1>
        <a href="/" style={{ color: "#4f46c7", fontWeight: 700 }}>Voltar para o início</a>
      </section>
    </main>
  );
}
