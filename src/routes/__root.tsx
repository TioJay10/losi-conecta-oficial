import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { MobileBottomNav } from "../components/mobile-bottom-nav";
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
    <main className={"losi-page-transition" + (location.pathname === "/" ? "" : " has-mobile-bottom-nav")}>
      <Outlet />
      {location.pathname !== "/" ? <MobileBottomNav /> : null}
    </main>
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