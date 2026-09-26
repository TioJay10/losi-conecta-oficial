import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import { Component, useEffect, useRef, useState } from "react";
import type { ErrorInfo, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import "../responsive.css";
import "../montserrat.css";
import "../panel-header-contrast.css";
import "../feed-modal-comments.css";
import { OnlinePresenceProvider } from "../components/OnlinePresence";

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
  const toastDragRef = useRef({ active: false, startY: 0, currentY: 0 });
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastOffsetY, setToastOffsetY] = useState(-18);

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

    function playNotificationSound() {
      const audio = audioRef.current;
      const url = activeSoundUrlRef.current;
      if (!audio || !url || audio.src !== url) return;

      try {
        audio.pause();
        if (audio.readyState >= 1) audio.currentTime = 0;
        audio.muted = false;
        audio.volume = 0.35;

        const playPromise = audio.play();
        if (playPromise) {
          void playPromise.catch((error) => {
            console.warn("O navegador bloqueou o som da notificação:", error);
          });
        }
      } catch (error) {
        console.warn("Não foi possível preparar o som da notificação:", error);
      }
    }

    function getNotificationMessage(notification: {
      type?: string | null;
      title?: string | null;
      message?: string | null;
    }) {
      const type = typeof notification.type === "string" ? notification.type.toLowerCase() : "";
      if (type.startsWith("feed_")) {
        return "Você recebeu uma nova interação no Feed.";
      }

      if (type.includes("like")) {
        return "Você recebeu uma nova curtida.";
      }

      const message =
        typeof notification.message === "string" ? notification.message.trim() : "";
      const title =
        typeof notification.title === "string" ? notification.title.trim() : "";

      return message || title || "Você tem uma nova notificação.";
    }

    function showToast(message: string) {
      if (currentPathRef.current === "/painel") return;
      setToastMessage(message);
      setToastOffsetY(-24);
      setToastVisible(true);
      window.requestAnimationFrame(() => {
        if (mounted) setToastOffsetY(0);
      });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        if (!mounted) return;
        setToastOffsetY(-18);
        setToastVisible(false);
      }, 5000);
    }

    async function processNewNotification(notification: {
      id: string;
      read_at: string | null;
      type?: string | null;
      title?: string | null;
      message?: string | null;
    }) {
      if (!mounted || knownNotificationIdsRef.current.has(notification.id)) return;
      knownNotificationIdsRef.current.add(notification.id);
      if (notification.read_at) return;

      try {
        const message = getNotificationMessage(notification);
        playNotificationSound();
        showToast(message);
      } catch (error) {
        console.warn("Erro isolado ao processar nova notificação:", error);
      }
    }

    async function start() {
      const { supabase } = await import("../lib/supabase");
      const { data: userData } = await supabase.auth.getUser();
      if (!mounted || !userData.user) return;

      await loadActiveSound();
      if (!mounted) return;

      channel = supabase
        .channel("global-notifications-" + userData.user.id)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: "user_id=eq." + userData.user.id,
          },
          (payload) => {
            void processNewNotification(
              payload.new as {
                id: string;
                read_at: string | null;
                type?: string | null;
                title?: string | null;
                message?: string | null;
              },
            );
          },
        )
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("Realtime de notificações indisponível:", status, error);
          }
        });
    }

    void start().catch((error) => {
      if (!mounted) return;
      console.warn("Não foi possível iniciar o sistema global de notificações:", error);
    });

    return () => {
      mounted = false;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (channel) void import("../lib/supabase").then(({ supabase }) => supabase.removeChannel(channel));
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentPath === "/painel") {
      setToastVisible(false);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    }
  }, [currentPath]);

  function handleToastPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    toastDragRef.current = {
      active: true,
      startY: event.clientY,
      currentY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleToastPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!toastDragRef.current.active) return;
    toastDragRef.current.currentY = event.clientY;
    const delta = event.clientY - toastDragRef.current.startY;
    if (delta < 0) {
      setToastOffsetY(Math.max(-90, delta));
    }
  }

  function handleToastPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!toastDragRef.current.active) return;
    const delta = toastDragRef.current.currentY - toastDragRef.current.startY;
    toastDragRef.current.active = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // O navegador pode já ter liberado o pointer capture.
    }

    if (delta <= -28) {
      setToastOffsetY(-90);
      window.setTimeout(() => setToastVisible(false), 180);
      return;
    }

    setToastOffsetY(0);
  }

  if (!toastVisible || currentPath === "/painel") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onPointerDown={handleToastPointerDown}
      onPointerMove={handleToastPointerMove}
      onPointerUp={handleToastPointerUp}
      onPointerCancel={handleToastPointerUp}
      style={{
        position: "fixed",
        top: 10,
        left: "50%",
        transform: `translate3d(-50%, ${toastOffsetY}px, 0)`,
        zIndex: 99999,
        width: "min(calc(100vw - 28px), 390px)",
        minHeight: 36,
        boxSizing: "border-box",
        padding: "8px 15px",
        borderRadius: 999,
        background: "rgba(13, 20, 31, 0.66)",
        border: "1px solid rgba(212, 175, 55, 0.34)",
        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
        backdropFilter: "blur(14px) saturate(125%)",
        WebkitBackdropFilter: "blur(14px) saturate(125%)",
        color: "#D4AF37",
        fontFamily: "Montserrat, Arial, sans-serif",
        fontSize: 11,
        lineHeight: 1.35,
        fontWeight: 600,
        letterSpacing: "0.01em",
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        transition: toastDragRef.current.active ? "none" : "transform 280ms cubic-bezier(.22,.8,.24,1), opacity 280ms ease",
        opacity: toastOffsetY <= -80 ? 0 : 1,
      }}
    >
      {toastMessage}
    </div>
  );
}

class GlobalNotificationErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Erro isolado no alerta global de notificações:", error, info);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function SafeGlobalNotificationAlerts({
  isAuthenticated,
  currentPath,
}: {
  isAuthenticated: boolean;
  currentPath: string;
}) {
  return (
    <GlobalNotificationErrorBoundary>
      <GlobalNotificationAlerts
        isAuthenticated={isAuthenticated}
        currentPath={currentPath}
      />
    </GlobalNotificationErrorBoundary>
  );
}

function RootComponent() {
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
        const session = result && "data" in result ? result.data.session : null;
        setIsAuthenticated(Boolean(session));
        setCurrentUserId(session?.user?.id ?? null);
        setAuthChecked(true);
      })
      .catch(() => {
        if (!mounted) return;
        setIsAuthenticated(false);
        setCurrentUserId(null);
        setAuthChecked(true);
      });

    let unsubscribe = () => {};
    import("../lib/supabase").then(({ supabase }) => {
      if (!mounted) return;
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (!session && event !== "SIGNED_OUT") return;
        setIsAuthenticated(Boolean(session));
        setCurrentUserId(session?.user?.id ?? null);
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
    <OnlinePresenceProvider userId={currentUserId}>
      <SafeGlobalNotificationAlerts isAuthenticated={isAuthenticated} currentPath={location.pathname} />
      <main>
        <Outlet />
      </main>
    </OnlinePresenceProvider>
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
