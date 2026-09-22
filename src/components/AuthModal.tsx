import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Mode = "login" | "signup" | "recovery";

type AuthModalProps = {
  onClose: () => void;
  onAuthenticated: () => void;
};

const APP_URL = import.meta.env.VITE_APP_URL || "https://losi-conecta-oficial.vercel.app";

export function AuthModal({ onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recoverySession, setRecoverySession] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    if (mode === "recovery") {
      if (recoverySession) {
        if (password.length < 6) {
          setError("A nova senha precisa ter pelo menos 6 caracteres.");
          setLoading(false);
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) setError("Não foi possível atualizar a senha. Solicite um novo link de recuperação.");
        else {
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

      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/entrar",
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
        options: { data: { full_name: name.trim() }, emailRedirectTo: APP_URL + "/painel" },
      });

      if (signupError) setError(signupError.message);
      else if (data.session) onAuthenticated();
      else {
        setMessage("Cadastro realizado. Verifique seu e-mail para confirmar a conta antes de entrar.");
        setMode("login");
      }
      setLoading(false);
      return;
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError(loginError.message || "E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError("O Supabase não retornou uma sessão. Tente novamente.");
      setLoading(false);
      return;
    }

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
      onAuthenticated();
    }

    setLoading(false);
  }

  const title = mode === "login" ? "Entrar no LOSI CONECTA" : mode === "signup" ? "Criar sua conta" : recoverySession ? "Definir nova senha" : "Recuperar senha";

  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose();
    }}>
      <section className="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button type="button" className="auth-modal-close" onClick={onClose} disabled={loading} aria-label="Fechar">×</button>
        <div className="auth-modal-brand-panel">
          <div className="auth-modal-brand">LOSI <span>CONECTA</span></div>
          <div className="auth-modal-eyebrow">PROFISSIONAIS DE EVENTOS</div>
          <h1 id="auth-modal-title">{title}</h1>
          <p>
            {mode === "login" && "Entre para continuar sua solicitação de orçamento."}
            {mode === "signup" && "Crie seu acesso para continuar de onde você parou."}
            {mode === "recovery" && (recoverySession ? "Escolha uma nova senha para sua conta." : "Informe seu e-mail para receber as instruções de acesso.")}
          </p>
        </div>
        <div className="auth-modal-form-panel">
          <form onSubmit={submit} className="auth-modal-form">
            {mode === "signup" && <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome" /></label>}
            {!recoverySession && <label>E-mail<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="voce@email.com" autoComplete="email" /></label>}
            {(mode !== "recovery" || recoverySession) && <label>{recoverySession ? "Nova senha" : "Senha"}<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Mínimo de 6 caracteres" autoComplete={recoverySession ? "new-password" : mode === "login" ? "current-password" : "new-password"} /></label>}
            {error && <div className="auth-modal-error">{error}</div>}
            {message && <div className="auth-modal-success">{message}</div>}
            <button disabled={loading} type="submit" className="auth-modal-submit">{loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : recoverySession ? "Atualizar senha" : "Enviar instruções"}</button>
          </form>
          {mode === "login" && <button className="auth-modal-link" onClick={() => { setMode("recovery"); setError(""); setMessage(""); }}>Esqueci minha senha</button>}
          <div className="auth-modal-footer">
            {mode === "login" ? <>Ainda não tem conta? <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Criar conta</button></> : <button onClick={() => { setMode("login"); setRecoverySession(false); setError(""); setMessage(""); }}>Voltar para entrar</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
