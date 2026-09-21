import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/entrar")({
  component: AuthPage,
});

type Mode = "login" | "signup" | "recovery";

const APP_URL = import.meta.env.VITE_APP_URL || "https://losi-conecta-oficial.vercel.app";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recoverySession, setRecoverySession] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const isRecoveryUrl =
        window.location.hash.includes("type=recovery") ||
        new URLSearchParams(window.location.search).has("code");
      if (data.session && (recoverySession || isRecoveryUrl)) {
        setRecoverySession(true);
        setMode("recovery");
        return;
      }
      // A existência de uma sessão persistida não deve abrir o painel automaticamente.
      // O acesso ao painel acontece somente após um login iniciado pelo usuário.
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoverySession(true);
        setMode("recovery");
        setMessage("");
        setError("");
        return;
      }
      if (session && event === "SIGNED_IN" && !recoverySession) {
        // O redirecionamento após login é tratado em submit(), depois da
        // verificação de bloqueio da conta. Isso evita uma corrida entre
        // onAuthStateChange e a checagem do perfil.
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    if (!supabase) {
      setError("O sistema ainda não está conectado ao Supabase.");
      setLoading(false);
      return;
    }

    if (mode === "recovery") {
      if (recoverySession) {
        if (password.length < 6) {
          setError("A nova senha precisa ter pelo menos 6 caracteres.");
          setLoading(false);
          return;
        }

        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          setError("Não foi possível atualizar a senha. Solicite um novo link de recuperação.");
        } else {
          await supabase.auth.signOut();
          setRecoverySession(false);
          setPassword("");
          setMode("login");
          setMessage("Senha atualizada com sucesso. Agora entre com sua nova senha.");
        }

        setLoading(false);
        return;
      }

      if (!email.trim()) {
        setError("Informe seu e-mail.");
        setLoading(false);
        return;
      }

      const recoveryRedirect = window.location.origin + "/entrar";
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: recoveryRedirect,
      });

      if (recoveryError) setError(recoveryError.message);
      else setMessage("Se este e-mail estiver cadastrado, enviaremos as instruções para redefinir sua senha.");

      setLoading(false);
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("A senha precisa ter pelo menos 6 caracteres.");
        setLoading(false);
        return;
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: APP_URL + "/painel",
        },
      });

      if (signupError) {
        setError(signupError.message);
      } else if (data.session) {
        navigate({ to: "/painel" });
      } else {
        setMessage("Cadastro realizado. Verifique seu e-mail para confirmar a conta antes de entrar.");
        setMode("login");
      }

      setLoading(false);
      return;
    }

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError(loginError.message || "E-mail ou senha inválidos.");
      } else if (data.session) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("blocked")
          .eq("id", data.session.user.id)
          .maybeSingle();

        if (profileError) {
          await supabase.auth.signOut();
          setError("Não foi possível validar sua conta. Tente novamente.");
        } else if (profile?.blocked) {
          await supabase.auth.signOut();
          setError("Esta conta está bloqueada. Entre em contato com a administração.");
        } else {
          setMessage("Login realizado. Abrindo seu painel...");
          await navigate({ to: "/painel" });
        }
      } else {
        setError("O Supabase não retornou uma sessão. Tente novamente.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o login.");
    }

    setLoading(false);
  }

  const title =
    mode === "login" ? "Entrar no LOSI CONECTA" :
    mode === "signup" ? "Criar sua conta" :
    recoverySession ? "Definir nova senha" :
    "Recuperar senha";

  return (
    <main className="auth-page" style={styles.page}>
      <section className="auth-card" style={styles.card}>
        <div style={styles.brand}>LOSI <span>CONECTA</span></div>
        <div style={styles.eyebrow}>PROFISSIONAIS DE EVENTOS</div>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>
          {mode === "login" && "Acesse sua conta para encontrar e conectar-se a fornecedores."}
          {mode === "signup" && "Crie seu acesso para fazer parte da rede de profissionais."}
          {mode === "recovery" && (recoverySession ? "Escolha uma nova senha para sua conta." : "Informe seu e-mail para receber as instruções de acesso.")}
        </p>

        <form onSubmit={submit} style={styles.form}>
          {mode === "signup" && (
            <label style={styles.label}>
              Nome
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome" style={styles.input} />
            </label>
          )}

          {!recoverySession && (
            <label style={styles.label}>
              E-mail
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="voce@email.com" autoComplete="email" style={styles.input} />
            </label>
          )}

          {(mode !== "recovery" || recoverySession) && (
            <label style={styles.label}>
              {recoverySession ? "Nova senha" : "Senha"}
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Mínimo de 6 caracteres" autoComplete={recoverySession ? "new-password" : mode === "login" ? "current-password" : "new-password"} style={styles.input} />
            </label>
          )}

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          <button disabled={loading} type="submit" style={styles.button}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : recoverySession ? "Atualizar senha" : "Enviar instruções"}
          </button>
        </form>

        {mode === "login" && (
          <button style={styles.link} onClick={() => { setMode("recovery"); setError(""); setMessage(""); }}>
            Esqueci minha senha
          </button>
        )}

        <div style={styles.footer}>
          {mode === "login" ? (
            <>Ainda não tem conta? <button style={styles.inlineLink} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Criar conta</button></>
          ) : (
            <button
              style={styles.inlineLink}
              onClick={() => {
                setMode("login");
                setRecoverySession(false);
                setError("");
                setMessage("");
              }}
            >
              Voltar para entrar
            </button>
          )}
        </div>

        <button style={styles.home} onClick={() => navigate({ to: "/" })}>← Voltar para o início</button>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f6fa", padding: 24, fontFamily: "Arial, sans-serif", color: "#172033" },
  card: { width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #e7e9f0", borderRadius: 20, padding: 36, boxSizing: "border-box", boxShadow: "0 18px 50px rgba(23,32,51,.08)" },
  brand: { fontSize: 21, fontWeight: 800, letterSpacing: ".06em", color: "#4f46c7" },
  title: { fontSize: 30, lineHeight: 1.15, margin: "14px 0 8px" },
  eyebrow: { marginTop: 24, fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: "#7a8191" },
  subtitle: { color: "#687386", lineHeight: 1.5, margin: "0 0 24px" },
  form: { display: "grid", gap: 16 },
  label: { display: "grid", gap: 7, fontSize: 13, fontWeight: 700 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #dfe2ea", borderRadius: 10, padding: "12px 13px", fontSize: 15, outline: "none" },
  button: { border: 0, borderRadius: 10, padding: "13px 16px", background: "#4f46c7", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  link: { display: "block", margin: "18px auto 0", border: 0, background: "transparent", color: "#4f46c7", fontWeight: 700, cursor: "pointer" },
  inlineLink: { border: 0, background: "transparent", padding: 0, color: "#4f46c7", fontWeight: 700, cursor: "pointer" },
  footer: { marginTop: 22, textAlign: "center", color: "#687386", fontSize: 14 },
  home: { display: "block", margin: "22px auto 0", border: 0, background: "transparent", color: "#687386", cursor: "pointer" },
  error: { background: "#fff1f1", color: "#a32f2f", borderRadius: 9, padding: "10px 12px", fontSize: 13, lineHeight: 1.4 },
  success: { background: "#eefaf3", color: "#237345", borderRadius: 9, padding: "10px 12px", fontSize: 13, lineHeight: 1.4 },
};
