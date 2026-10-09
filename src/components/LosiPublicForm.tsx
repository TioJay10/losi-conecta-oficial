import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { formsAction } from "../lib/losi-forms";
import type { FormAnswers, PublicForm } from "../lib/losi-forms";
import { LosiFormFields } from "./LosiFormFields";
import { PanelMenuIcon } from "./PanelMenuIcon";
import "../losi-forms.css";
export function LosiPublicForm({
  token,
  supplier = false,
}: {
  token: string;
  supplier?: boolean;
}) {
  const [form, setForm] = useState<PublicForm | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [answers, setAnswers] = useState<FormAnswers>({}),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [needsLogin, setNeedsLogin] = useState(false),
    [reload, setReload] = useState(0);
  const requestId = useRef<string | null>(null),
    lock = useRef(false),
    started = useRef(Date.now());
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setNeedsLogin(false);
    setError("");
    void (async () => {
      try {
        if (supplier) {
          const session = await supabase.auth.getSession();
          if (!session.data.session) {
            if (mounted) {
              setNeedsLogin(true);
              setLoading(false);
            }
            return;
          }
        }
        const result = await formsAction<{
          form: PublicForm;
          answered?: boolean;
          name?: string;
        }>(supplier ? "supplier-get" : "public-get", { token });
        if (mounted) {
          setForm(result.form);
          if (result.name) setName(result.name);
          setSent(!!result.answered);
          requestId.current = crypto.randomUUID();
          started.current = Date.now();
        }
      } catch (e) {
        if (mounted)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar o formulário.",
          );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, supplier, reload]);
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || !form) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const website = new FormData(e.currentTarget).get("website");
    try {
      if (Date.now() - started.current < 1000)
        throw new Error("Confira as informações antes de enviar.");
      await formsAction(supplier ? "supplier-submit" : "public-submit", {
        token,
        version: form.version,
        requestId: requestId.current,
        name,
        answers,
        website,
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar. Tente novamente.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <main className="lf-public-page">
      <header className="lf-public-brand">
        <a href="/">
          LOSI <strong>CONECTA</strong>
        </a>
        {supplier && (
          <a className="lf-public-back" href="/formularios">
            Voltar ao painel
          </a>
        )}
      </header>
      <section className="lf-public-surface">
        {loading ? (
          <p className="lf-empty" role="status">
            Carregando formulário…
          </p>
        ) : needsLogin ? (
          <div className="lf-empty">
            <h1>Formulário para fornecedores LOSI</h1>
            <p>
              Entre na conta que recebeu o convite. O formulário estará em
              “Formulários recebidos”.
            </p>
            <a className="lf-button lf-primary" href="/entrar">
              Entrar na minha conta
            </a>
          </div>
        ) : sent ? (
          <div className="lf-success" role="status">
            <PanelMenuIcon name="check" />
            <h1>Resposta recebida!</h1>
            <p>
              Suas informações foram enviadas à empresa responsável pelo
              formulário.
            </p>
            {supplier && (
              <a className="lf-button" href="/formularios">
                Voltar aos formulários
              </a>
            )}
          </div>
        ) : !form ? (
          <div className="lf-empty">
            <h1>Formulário indisponível</h1>
            <p role="alert">
              {error || "Este formulário foi encerrado ou não está disponível."}
            </p>
            <button onClick={() => setReload((v) => v + 1)}>
              <PanelMenuIcon name="refresh" />
              Tentar novamente
            </button>
          </div>
        ) : form.audience === "suppliers" && !supplier ? (
          <div className="lf-empty">
            <h1>Formulário para fornecedores convidados</h1>
            <p>
              Entre na sua conta LOSI e abra o convite em “Formulários
              recebidos”.
            </p>
            <a className="lf-button lf-primary" href="/formularios">
              Ir aos meus formulários
            </a>
          </div>
        ) : (
          <>
            <div className="lf-public-heading">
              <strong>{form.business_name}</strong>
              <h1>{form.title}</h1>
              {form.description && <p>{form.description}</p>}
              {supplier && (
                <p className="lf-muted">
                  Sua resposta será vinculada ao seu perfil de fornecedor.
                </p>
              )}
            </div>
            <form onSubmit={send}>
              <div className="lf-fields">
                <label>
                  Nome completo
                  <span className="lf-required"> (obrigatório)</span>
                  <input
                    autoComplete="name"
                    value={name}
                    maxLength={200}
                    required
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              </div>
              <LosiFormFields
                fields={form.fields}
                answers={answers}
                onChange={setAnswers}
                disabled={busy}
              />
              <div className="lf-honeypot" aria-hidden="true">
                <label>
                  Website
                  <input name="website" autoComplete="off" tabIndex={-1} />
                </label>
              </div>
              <p className="lf-muted">
                Suas respostas serão recebidas por {form.business_name}. Não
                serão exibidas publicamente.
              </p>
              {error && (
                <p className="lf-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="lf-primary lf-submit"
                type="submit"
                disabled={busy}
              >
                <PanelMenuIcon name="send" />
                {busy ? "Enviando formulário…" : "Enviar formulário"}
              </button>
            </form>
          </>
        )}
      </section>
      <footer className="lf-public-footer">Formulários LOSI Conecta</footer>
    </main>
  );
}
