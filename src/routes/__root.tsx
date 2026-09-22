import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "../responsive.css";
import "../montserrat.css";


.auth-required-page{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:linear-gradient(145deg,#0b1626 0%,#142238 100%);color:#fff;font-family:"Montserrat",Arial,sans-serif}
.auth-required-card{width:min(100%,560px);box-sizing:border-box;padding:46px 38px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:linear-gradient(145deg,rgba(18,31,50,.98),rgba(8,17,30,.98));box-shadow:0 24px 70px rgba(0,0,0,.35);text-align:center}
.auth-required-card::before{content:"";display:block;width:54px;height:4px;margin:0 auto 24px;border-radius:99px;background:#d6b15b}
.auth-required-card .auth-required-kicker{color:#d6b15b;font-size:11px;font-weight:800;letter-spacing:.16em}
.auth-required-card h1{margin:14px 0 12px;font-size:clamp(25px,5vw,34px);line-height:1.15;color:#fff}
.auth-required-card p{margin:0 auto 28px;max-width:460px;color:#c4cedb;line-height:1.7;font-size:14px}
.auth-required-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:10px;background:#d6b15b;color:#101a29;font-size:13px;font-weight:800;text-decoration:none;box-shadow:0 8px 20px rgba(214,177,91,.18);transition:transform .18s ease,filter .18s ease}
.auth-required-button:hover{filter:brightness(1.06);transform:translateY(-1px)}
@media(max-width:600px){.auth-required-page{padding:16px}.auth-required-card{padding:36px 22px;border-radius:16px}.auth-required-card h1{font-size:25px}.auth-required-card p{font-size:13px}.auth-required-button{width:100%;box-sizing:border-box}}

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

    import("../lib/supabase").then(({ supabase }) => supabase.auth.getSession()).then(({ data }) => {
      if (!mounted) return;
      setIsAuthenticated(Boolean(data.session));
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
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const publicRoute = location.pathname === "/entrar";

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
          <div style={{color:"#d6b15b",fontSize:12,fontWeight:800,letterSpacing:".12em"}}>ACESSO RESTRITO</div>
          <h1 style={{margin:"14px 0 10px"}}>Você precisa estar logado</h1>
          <p style={{margin:"0 auto 26px",maxWidth:460,color:"#c4cedb",lineHeight:1.65}}>Para visualizar fornecedores, perfis, serviços e utilizar as funções do LOSI CONECTA, entre na sua conta.</p>
          <a href="/entrar" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:46,padding:"0 22px",borderRadius:10,background:"#d6b15b",color:"#101a29",fontWeight:800,textDecoration:"none"}}>Entrar na minha conta</a>
        </section>
      </main>
    );
  }

  return <Outlet />;
}

function RootErrorComponent() {
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
          Ocorreu um erro inesperado. Recarregue a página e tente novamente.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
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
          Recarregar
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