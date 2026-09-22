import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import "../responsive.css";
import "../montserrat.css";


.auth-required-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
  background: linear-gradient(145deg, #0b1626, #142238);
  color: #fff;
  font-family: "Montserrat", Arial, sans-serif;
}

.auth-required-card {
  width: min(100%, 560px);
  box-sizing: border-box;
  padding: 42px 34px;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 18px;
  background: rgba(18,31,50,.96);
  box-shadow: 0 24px 70px rgba(0,0,0,.3);
  text-align: center;
}

.auth-required-card strong {
  color: #d6b15b;
  letter-spacing: .12em;
  font-size: 13px;
}

.auth-required-kicker {
  color: #d6b15b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
}

.auth-required-card h1 {
  margin: 14px 0 10px;
  font-size: clamp(24px, 5vw, 34px);
}

.auth-required-card p {
  margin: 0 auto 26px;
  max-width: 460px;
  color: #c4cedb;
  line-height: 1.65;
}

.auth-required-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 22px;
  border-radius: 10px;
  background: #d6b15b;
  color: #101a29;
  font-weight: 800;
  text-decoration: none;
}

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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthenticated(Boolean(data.session));
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsAuthenticated(Boolean(session));
      setAuthChecked(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const publicRoute = location.pathname === "/entrar";

  if (!authChecked && !publicRoute) {
    return (
      <main className="auth-required-page">
        <section className="auth-required-card">
          <strong>LOSI CONECTA</strong>
          <h1>Verificando seu acesso...</h1>
          <p>Aguarde enquanto confirmamos sua sessão.</p>
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
          <a href="/entrar" className="auth-required-button">Entrar na minha conta</a>
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