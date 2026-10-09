import { useCallback, useEffect, useRef, useState } from "react";
import { PanelMenuIcon } from "./PanelMenuIcon";
import { LosiFormFields } from "./LosiFormFields";
import { formWhatsAppLink } from "../lib/form-whatsapp";
import {
  createFormDraft,
  fieldTypes,
  formLink,
  formsAction,
  formStatuses,
  formTemplates,
  responseStatuses,
  supplierSlug,
} from "../lib/losi-forms";
import type {
  FormAnswers,
  FormDraft,
  FormField,
  FormInvitation,
  FormResponse,
  LosiForm,
} from "../lib/losi-forms";
import "../losi-forms.css";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir agora.";
const date = (s: string) => new Date(s).toLocaleString("pt-BR");
export function LosiForms() {
  const [forms, setForms] = useState<LosiForm[]>([]),
    [business, setBusiness] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"forms" | "responses" | "inbox">("forms"),
    [editing, setEditing] = useState<LosiForm | null>(null),
    [draft, setDraft] = useState<FormDraft | null>(null),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(false),
    [previewAnswers, setPreviewAnswers] = useState<FormAnswers>({});
  const [busy, setBusy] = useState(false),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [invites, setInvites] = useState<FormInvitation[]>([]),
    [inboxLoading, setInboxLoading] = useState(false);
  const [confirm, setConfirm] = useState<LosiForm | null>(null),
    [share, setShare] = useState<LosiForm | null>(null),
    [profileLink, setProfileLink] = useState("");
  const lock = useRef(false);
  const update = (patch: Partial<FormDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : null));
    setDirty(true);
  };
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await formsAction<{ forms: LosiForm[]; business_name: string }>(
        "list",
      );
      setForms(r.forms);
      setBusiness(r.business_name);
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  async function action(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function closeEditor() {
    if (
      dirty &&
      !window.confirm("Você tem alterações não salvas. Deseja descartá-las?")
    )
      return;
    setDraft(null);
    setEditing(null);
    setDirty(false);
    setPreview(false);
  }
  function edit(f?: LosiForm) {
    if (dirty && !window.confirm("Descartar as alterações não salvas?")) return;
    setEditing(f ?? null);
    setDraft(
      f
        ? {
            title: f.title,
            description: f.description,
            template: f.template,
            fields: f.fields,
            audience: f.audience,
            status: f.status,
            notify: f.notify,
          }
        : createFormDraft(),
    );
    setDirty(false);
    setPreview(false);
    setPreviewAnswers({});
    setError("");
    setNotice("");
  }
  async function save(status: FormDraft["status"]) {
    if (!draft) return;
    const nextErrors: Record<string, string> = {};
    draft.fields.forEach((field) => {
      if (!field.label.trim()) nextErrors[field.id] = "Digite o texto da pergunta.";
      if (["select", "multi"].includes(field.type)) {
        const options = field.options.map((option) => option.trim()).filter(Boolean);
        if (new Set(options).size < 2) nextErrors[field.id] = "Adicione pelo menos duas opções diferentes e preenchidas.";
      }
    });
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError("Verifique os campos destacados em vermelho.");
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>("[data-form-error=\"true\"]");
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
        first?.focus();
      });
      return;
    }
    setFieldErrors({});
    await action(async () => {
      const r = await formsAction<{ form: LosiForm }>("save", {
        id: editing?.id,
        version: editing?.version,
        form: { ...draft, status },
      });
      setForms((v) => [r.form, ...v.filter((f) => f.id !== r.form.id)]);
      setEditing(r.form);
      setDraft(r.form);
      setDirty(false);
      setNotice(
        status === "open"
          ? "Formulário publicado. Compartilhe o link ou convide um fornecedor."
          : "Formulário salvo.",
      );
      if (status === "open") {
        setShare(r.form);
        setDraft(null);
        setEditing(null);
        setPreview(false);
      }
    });
  }
  async function copyLink(f: LosiForm) {
    try {
      await navigator.clipboard.writeText(formLink(f));
      setNotice("Link copiado. Envie para quem deve responder.");
    } catch {
      setNotice("Copie o link exibido no campo de compartilhamento.");
      setShare(f);
    }
  }
  async function inbox() {
    setInboxLoading(true);
    try {
      setInvites(
        (await formsAction<{ invitations: FormInvitation[] }>("inbox"))
          .invitations,
      );
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setInboxLoading(false);
    }
  }
  const fieldUpdate = (id: string, patch: Partial<FormField>) =>
    update({
      fields: draft!.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  function moveField(index: number, direction: number) {
    const fields = [...draft!.fields];
    const to = index + direction;
    if (to < 0 || to >= fields.length) return;
    [fields[index], fields[to]] = [fields[to], fields[index]];
    update({ fields });
  }
  return (
    <div className="lf-workspace">
      <header className="lf-page-heading">
        <div>
          <h1>Formulários</h1>
          <p>
            Receba contatos, pedidos de proposta e inscrições em um só lugar.
          </p>
        </div>
        {!draft && (
          <button className="lf-primary" onClick={() => edit()}>
            <PanelMenuIcon name="plus" />
            Criar formulário
          </button>
        )}
      </header>
      {error && (
        <div className="lf-error" role="alert">
          {error}
          {!draft && (
            <button onClick={() => void refresh()}>Tentar novamente</button>
          )}
        </div>
      )}
      {notice && (
        <div className="lf-notice" role="status">
          {notice}
        </div>
      )}
      {!draft && (
        <nav className="lf-tabs" aria-label="Áreas de formulários">
          {(
            [
              { key: "forms", label: "Meus formulários", icon: "forms" },
              { key: "responses", label: "Respostas recebidas", icon: "inbox" },
              {
                key: "inbox",
                label: "Formulários recebidos",
                icon: "communication",
              },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => {
                setTab(t.key);
                setShare(null);
                if (t.key === "inbox") void inbox();
              }}
            >
              <PanelMenuIcon name={t.icon} />
              <span>{t.label}</span>
              {t.key === "inbox" && invites.length > 0 && (
                <span className="lf-tab-count" aria-label={`${invites.length} formulários recebidos`}>
                  {invites.length > 99 ? "99+" : invites.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      )}
      {draft ? (
        <section className="lf-surface">
          <fieldset className="lf-editor-disabled" disabled={busy}>
            <div className="lf-section-heading">
              <h2>{editing ? "Editar formulário" : "Criar formulário"}</h2>
              <button disabled={busy} onClick={closeEditor}>
                <PanelMenuIcon name="back" />
                Voltar
              </button>
            </div>
            <div className="lf-editor-tabs">
              <button aria-pressed={!preview} onClick={() => setPreview(false)}>
                <PanelMenuIcon name="customization" />
                Editar perguntas
              </button>
              <button aria-pressed={preview} onClick={() => setPreview(true)}>
                <PanelMenuIcon name="eye" />
                Prévia
              </button>
            </div>
            {preview ? (
              <div className="lf-preview">
                <div className="lf-public-heading">
                  <strong>{business}</strong>
                  <h2>{draft.title || "Título do formulário"}</h2>
                  <p>{draft.description}</p>
                </div>
                <label>
                  Nome completo (obrigatório)
                  <input placeholder="Nome de quem responde" />
                </label>
                <LosiFormFields
                  fields={draft.fields}
                  answers={previewAnswers}
                  onChange={setPreviewAnswers}
                />
                <p className="lf-muted">
                  Prévia de preenchimento. Nenhuma resposta será enviada.
                </p>
              </div>
            ) : (
              <div className="lf-editor-grid">
                <div>
                  <div className="lf-fields">
                    <label>
                      Modelo
                      <select
                        value={draft.template}
                        disabled={!!editing}
                        onChange={(e) => {
                          if (
                            dirty &&
                            !window.confirm(
                              "Trocar o modelo substitui as perguntas atuais. Continuar?",
                            )
                          )
                            return;
                          const next = createFormDraft(e.target.value);
                          update({
                            ...next,
                            audience: draft.audience,
                            notify: draft.notify,
                            status: draft.status,
                          });
                        }}
                      >
                        {formTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Título do formulário
                      <input
                        maxLength={160}
                        value={draft.title}
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </label>
                    <label>
                      Apresentação
                      <textarea
                        maxLength={3000}
                        value={draft.description}
                        onChange={(e) =>
                          update({ description: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="lf-fixed-question">
                    <strong>Nome completo</strong>
                    <span>Obrigatório em todos os formulários</span>
                  </div>
                  <h3 className="lf-question-heading">Perguntas</h3>
                  {draft.fields.map((f, i) => (
                    <section className={`lf-question ${fieldErrors[f.id] ? "lf-question-error" : ""}`} key={f.id} data-form-error={fieldErrors[f.id] ? "true" : undefined}>
                      <div className="lf-question-controls">
                        <span>Pergunta {i + 1}</span>
                        <div className="lf-icon-actions">
                          <button
                            disabled={busy || i === 0}
                            aria-label={
                              "Mover pergunta " + (i + 1) + " para cima"
                            }
                            onClick={() => moveField(i, -1)}
                          >
                            <PanelMenuIcon name="up" />
                          </button>
                          <button
                            disabled={busy || i === draft.fields.length - 1}
                            aria-label={
                              "Mover pergunta " + (i + 1) + " para baixo"
                            }
                            onClick={() => moveField(i, 1)}
                          >
                            <PanelMenuIcon name="down" />
                          </button>
                          <button
                            disabled={busy || draft.fields.length <= 1}
                            aria-label={"Excluir pergunta " + (i + 1)}
                            onClick={() =>
                              update({
                                fields: draft.fields.filter(
                                  (x) => x.id !== f.id,
                                ),
                              })
                            }
                          >
                            <PanelMenuIcon name="trash" />
                          </button>
                        </div>
                      </div>
                      <div className="lf-two">
                        <label>
                          Pergunta
                          <input
                            maxLength={200}
                            value={f.label}
                            onChange={(e) =>
                              fieldUpdate(f.id, { label: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Tipo de resposta
                          <select
                            value={f.type}
                            onChange={(e) =>
                              fieldUpdate(f.id, {
                                type: e.target.value as FormField["type"],
                                options: ["select", "multi"].includes(
                                  e.target.value,
                                )
                                  ? f.options.length
                                    ? f.options
                                    : ["Opção 1", "Opção 2"]
                                  : [],
                              })
                            }
                          >
                            {Object.entries(fieldTypes).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {["select", "multi"].includes(f.type) && (
                        <label>
                          Opções (uma por linha)
                          <textarea
                            value={f.options.join("\n")}
                            className={fieldErrors[f.id] ? "lf-input-error" : ""}
                            aria-invalid={Boolean(fieldErrors[f.id])}
                            onChange={(e) => {
                              fieldUpdate(f.id, { options: e.target.value.split("\n") });
                              setFieldErrors((errors) => {
                                const next = { ...errors };
                                delete next[f.id];
                                return next;
                              });
                            }}
                          />
                          {fieldErrors[f.id] && <span className="lf-field-error" role="alert">{fieldErrors[f.id]}</span>}
                        </label>
                      )}
                      <label className="lf-check">
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) =>
                            fieldUpdate(f.id, { required: e.target.checked })
                          }
                        />
                        Resposta obrigatória
                      </label>
                    </section>
                  ))}
                  <button
                    disabled={busy || draft.fields.length >= 40}
                    onClick={() =>
                      update({
                        fields: [
                          ...draft.fields,
                          {
                            id: crypto.randomUUID(),
                            label: "Nova pergunta",
                            type: "text",
                            required: false,
                            options: [],
                          },
                        ],
                      })
                    }
                  >
                    <PanelMenuIcon name="plus" />
                    Adicionar pergunta
                  </button>
                </div>
                <aside className="lf-settings">
                  <h3>Quem pode responder?</h3>
                  <div className="lf-audience">
                    {(
                      [
                        {
                          id: "public",
                          label: "Qualquer pessoa pelo link",
                          icon: "link",
                        },
                        {
                          id: "suppliers",
                          label: "Fornecedores LOSI convidados",
                          icon: "businesses",
                        },
                        { id: "both", label: "As duas formas", icon: "users" },
                      ] as const
                    ).map((a) => (
                      <button
                        key={a.id}
                        aria-pressed={draft.audience === a.id}
                        onClick={() => update({ audience: a.id })}
                      >
                        <PanelMenuIcon name={a.icon} />
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="lf-muted">
                    {draft.audience === "public"
                      ? "O link público não exige cadastro na LOSI."
                      : draft.audience === "suppliers"
                        ? "Convide pelo link do perfil público. Apenas a conta convidada pode responder."
                        : "Receba pelo link público e convide fornecedores. Cada resposta identifica a origem."}
                  </p>
                  <h3>Recebimento</h3>
                  <label className="lf-check">
                    <input
                      type="checkbox"
                      checked={draft.notify}
                      onChange={(e) => update({ notify: e.target.checked })}
                    />
                    Notificar novas respostas
                  </label>
                  <p className="lf-muted">
                    As respostas ficam disponíveis somente para você.
                  </p>
                </aside>
              </div>
            )}
            <div className="lf-editor-footer">
              <button
                disabled={busy}
                onClick={() => void save(editing?.status ?? "draft")}
              >
                {" "}
                {busy ? "Salvando…" : "Salvar alterações"}
              </button>
              <button
                className="lf-primary"
                disabled={busy}
                onClick={() => void save("open")}
              >
                <PanelMenuIcon name="send" />
                {busy
                  ? "Aguarde…"
                  : editing?.status === "open"
                    ? "Salvar e compartilhar"
                    : "Publicar formulário"}
              </button>
            </div>
          </fieldset>
        </section>
      ) : (
        <>
          {tab === "forms" && (
            <section className="lf-surface">
              <div className="lf-section-heading">
                <h2>Meus formulários</h2>
                <button disabled={loading} onClick={() => void refresh()}>
                  <PanelMenuIcon name="refresh" />
                  Atualizar
                </button>
              </div>
              <label className="lf-search">
                Buscar formulário
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Título ou tipo de formulário"
                />
              </label>
              {loading ? (
                <p className="lf-empty" role="status">
                  Carregando formulários…
                </p>
              ) : forms.filter((f) =>
                  (
                    f.title +
                    " " +
                    (formTemplates.find((t) => t.id === f.template)?.name ?? "")
                  )
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ).length === 0 ? (
                <div className="lf-empty">
                  <h3>
                    {forms.length
                      ? "Nenhum formulário encontrado"
                      : "Crie seu primeiro formulário"}
                  </h3>
                  <p>
                    {forms.length
                      ? "Tente outro título na busca."
                      : "Escolha um modelo e adapte as perguntas para seu evento, contato ou seleção."}
                  </p>
                  {!forms.length && (
                    <button className="lf-primary" onClick={() => edit()}>
                      Criar formulário
                    </button>
                  )}
                </div>
              ) : (
                <div className="lf-form-list">
                  {forms
                    .filter((f) =>
                      (
                        f.title +
                        " " +
                        (formTemplates.find((t) => t.id === f.template)?.name ??
                          "")
                      )
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((f) => (
                      <article className="lf-form-row" key={f.id}>
                        <div className="lf-form-info">
                          <h3>{f.title}</h3>
                          <p>
                            {formTemplates.find((t) => t.id === f.template)
                              ?.name ?? "Formulário livre"}{" "}
                            · {date(f.created_at)}
                          </p>
                          <p className="lf-response-count">
                            Respostas recebidas: <strong>{f.response_count ?? 0}</strong>
                          </p>
                          <span className={"lf-badge " + f.status}>
                            {formStatuses[f.status]}
                          </span>
                        </div>
                        <div className="lf-row-actions">
                          <button disabled={busy} onClick={() => edit(f)}>
                            <PanelMenuIcon name="customization" />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              setSelected(f.id);
                              setTab("responses");
                            }}
                          >
                            <PanelMenuIcon name="inbox" />
                            Respostas
                          </button>
                          {f.status === "open" && (
                            <button
                              onClick={() => {
                                setShare(f);
                                setProfileLink("");
                              }}
                            >
                              <PanelMenuIcon name="send" />
                              Compartilhar
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action(async () => {
                                const r = await formsAction<{ form: LosiForm }>(
                                  "save",
                                  {
                                    form: {
                                      ...f,
                                      title: (f.title + " (cópia)").slice(
                                        0,
                                        160,
                                      ),
                                      status: "draft",
                                    },
                                  },
                                );
                                setForms((v) => [r.form, ...v]);
                                setNotice("Cópia criada como rascunho.");
                              })
                            }
                          >
                            <PanelMenuIcon name="copy" />
                            Duplicar
                          </button>
                          {f.status !== "draft" && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void action(async () => {
                                  const r = await formsAction<{
                                    form: LosiForm;
                                  }>("save", {
                                    id: f.id,
                                    version: f.version,
                                    form: {
                                      ...f,
                                      status:
                                        f.status === "open" ? "closed" : "open",
                                    },
                                  });
                                  setForms((v) =>
                                    v.map((x) => (x.id === f.id ? r.form : x)),
                                  );
                                  setNotice(
                                    f.status === "open"
                                      ? "Recebimento encerrado. As respostas continuam salvas."
                                      : "Formulário reaberto.",
                                  );
                                })
                              }
                            >
                              {f.status === "open" ? "Encerrar" : "Reabrir"}
                            </button>
                          )}
                          <button disabled={busy} onClick={() => setConfirm(f)}>
                            <PanelMenuIcon name="trash" />
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </section>
          )}
          {share && tab === "forms" && (
            <section
              className="lf-surface"
              aria-label="Compartilhar formulário"
            >
              <div className="lf-section-heading">
                <h2>Compartilhar: {share.title}</h2>
                <button onClick={() => setShare(null)}>
                  <PanelMenuIcon name="close" />
                  Fechar
                </button>
              </div>
              {["public", "both"].includes(share.audience) && (
                <div className="lf-share-group">
                  <label>
                    Link público
                    <input
                      readOnly
                      value={formLink(share)}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <div className="lf-row-actions">
                    <button
                      className="lf-primary"
                      onClick={() => void copyLink(share)}
                    >
                      <PanelMenuIcon name="copy" />
                      Copiar link
                    </button>
                    <a
                      className="lf-button"
                      href={formLink(share)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <PanelMenuIcon name="eye" />
                      Abrir formulário
                    </a>
                  </div>
                </div>
              )}
              {["suppliers", "both"].includes(share.audience) && (
                <div className="lf-share-group">
                  <label>
                    Link do perfil público do fornecedor
                    <input
                      value={profileLink}
                      onChange={(e) => setProfileLink(e.target.value)}
                      placeholder="https://www.losiconecta.com.br/fornecedor/…"
                    />
                  </label>
                  <p className="lf-muted">
                    Ele receberá uma notificação e encontrará o formulário em
                    “Formulários recebidos”.
                  </p>
                  <button
                    className="lf-primary"
                    disabled={busy || !profileLink.trim()}
                    onClick={() =>
                      void action(async () => {
                        const result = await formsAction<{ name: string }>(
                          "invite",
                          { id: share.id, slug: supplierSlug(profileLink) },
                        );
                        setNotice(
                          "Formulário enviado para " + result.name + ".",
                        );
                        setProfileLink("");
                      })
                    }
                  >
                    <PanelMenuIcon name="send" />
                    {busy ? "Enviando…" : "Enviar ao fornecedor"}
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === "responses" && (
            <LosiFormResponses
              forms={forms}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          {tab === "inbox" && (
            <section className="lf-surface">
              <div className="lf-section-heading">
                <h2>Formulários recebidos</h2>
                <button disabled={inboxLoading} onClick={() => void inbox()}>
                  <PanelMenuIcon name="refresh" />
                  Atualizar
                </button>
              </div>
              {inboxLoading ? (
                <p className="lf-empty">Carregando formulários…</p>
              ) : !invites.length ? (
                <div className="lf-empty">
                  <h3>Nenhum formulário recebido</h3>
                  <p>
                    Os formulários enviados por outros fornecedores aparecerão
                    aqui.
                  </p>
                </div>
              ) : (
                invites.map((i) => (
                  <article className="lf-form-row" key={i.id}>
                    <div>
                      <h3>{i.form.title}</h3>
                      <p>
                        Enviado por {i.company || "Fornecedor LOSI"} ·{" "}
                        {date(i.created_at)}
                      </p>
                      <span className="lf-badge">
                        {i.answered
                          ? "Respondido"
                          : i.form.status === "open"
                            ? "Aguardando sua resposta"
                            : "Encerrado"}
                      </span>
                    </div>
                    {!i.answered && i.form.status === "open" && (
                      <a
                        className="lf-button lf-primary"
                        href={formLink(i.form, true)}
                      >
                        Responder formulário
                        <PanelMenuIcon name="send" />
                      </a>
                    )}
                  </article>
                ))
              )}
            </section>
          )}
        </>
      )}
      {confirm && (
        <FormDeleteDialog
          form={confirm}
          busy={busy}
          onClose={() => setConfirm(null)}
          onDelete={() =>
            void action(async () => {
              await formsAction("delete", { id: confirm.id });
              setForms((v) => v.filter((f) => f.id !== confirm.id));
              if (share?.id === confirm.id) setShare(null);
              setConfirm(null);
              setNotice("Formulário excluído.");
            })
          }
        />
      )}
    </div>
  );
}
function FormDeleteDialog({
  form,
  busy,
  onClose,
  onDelete,
}: {
  form: LosiForm;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="lf-dialog"
      aria-labelledby="lf-delete-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <h2 id="lf-delete-title">Excluir formulário?</h2>
      <p>
        “{form.title}” e todas as respostas recebidas serão excluídos
        permanentemente.
      </p>
      <div className="lf-row-actions">
        <button autoFocus disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button className="lf-danger" disabled={busy} onClick={onDelete}>
          <PanelMenuIcon name="trash" />
          {busy ? "Excluindo…" : "Excluir formulário"}
        </button>
      </div>
    </dialog>
  );
}
function LosiFormResponses({
  forms,
  selected,
  onSelect,
}: {
  forms: LosiForm[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [rows, setRows] = useState<FormResponse[]>([]),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [source, setSource] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState(""),
    [page, setPage] = useState(0),
    [expanded, setExpanded] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const lock = useRef(false);
  useEffect(() => {
    if (!selected && forms.length) onSelect(forms[0].id);
  }, [selected, forms, onSelect]);
  useEffect(() => {
    setPage(0);
    setExpanded(null);
  }, [selected, search, source, status, from, until]);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    if (!selected) {
      setRows([]);
      setCount(0);
      return;
    }
    setLoading(true);
    try {
      const r = await formsAction<{ responses: FormResponse[]; count: number }>(
        "responses",
        { id: selected, page, search, source, status, from, until },
      );
      if (seq === sequence.current) {
        setRows(r.responses);
        setCount(r.count);
        setError("");
      }
    } catch (e) {
      if (seq === sequence.current) setError(errorText(e));
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, [selected, page, search, source, status, from, until]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 250);
    return () => {
      clearTimeout(timer);
      sequence.current++;
    };
  }, [refresh]);
  async function change(r: FormResponse, next: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await formsAction("response-status", {
        id: selected,
        responseId: r.id,
        status: next,
      });
      setRows((v) =>
        v.map((x) =>
          x.id === r.id ? { ...x, status: next as FormResponse["status"] } : x,
        ),
      );
      await refresh();
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="lf-surface">
      <div className="lf-section-heading">
        <h2 className="lf-heading-with-count">
          Respostas recebidas
          <span className="lf-heading-count" aria-label="Quantidade de respostas recebidas">
            {count}
          </span>
        </h2>
        <button disabled={loading} onClick={() => void refresh()}>
          <PanelMenuIcon name="refresh" />
          Atualizar
        </button>
      </div>
      <div className="lf-response-filters">
        <label>
          Formulário
          <select value={selected} onChange={(e) => onSelect(e.target.value)}>
            <option value="">Escolha um formulário</option>
            {forms.map((f) => (
              <option value={f.id} key={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar por nome
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome de quem respondeu"
          />
        </label>
        <label>
          Origem
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Todas</option>
            <option value="public">Link público</option>
            <option value="supplier">Fornecedor LOSI</option>
          </select>
        </label>
        <label>
          Situação
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(responseStatuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="lf-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="lf-empty" role="status">
          Carregando respostas…
        </p>
      ) : !rows.length ? (
        <div className="lf-empty">
          <h3>
            {selected
              ? "Nenhuma resposta encontrada"
              : "Selecione um formulário"}
          </h3>
          <p>
            {selected
              ? "Compartilhe o formulário ou ajuste os filtros para ver as respostas."
              : "Crie um formulário para começar a receber informações."}
          </p>
        </div>
      ) : (
        rows.map((r) => (
          <article key={r.id} className="lf-response-row">
            <div className="lf-form-row">
              <div>
                <h3>{r.respondent_name}</h3>
                <p>
                  {date(r.created_at)} ·{" "}
                  {r.source === "public" ? "Link público" : "Fornecedor LOSI"}
                </p>
                <span className="lf-badge">{responseStatuses[r.status]}</span>
              </div>
              <button
                aria-expanded={expanded === r.id}
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <PanelMenuIcon name={expanded === r.id ? "up" : "down"} />
                {expanded === r.id ? "Fechar resposta" : "Ver resposta"}
              </button>
            </div>
            {expanded === r.id && (
              <div className="lf-response-detail">
                <dl>
                  {r.definition.fields.map((f) => {
                    const answer = r.answers[f.id];
                    const whatsapp = (f.type === "phone" || /whats\s*app/i.test(f.label))
                      ? formWhatsAppLink(answer) : null;
                    return (
                    <div key={f.id}>
                      <dt>{f.label}</dt>
                      <dd>
                        {whatsapp ? (
                          <a className="lf-whatsapp-link" href={whatsapp} target="_blank" rel="noopener noreferrer"
                            aria-label={`Conversar com ${r.respondent_name} pelo WhatsApp: ${answer}`}>
                            {answer}<span aria-hidden="true">Abrir WhatsApp ↗</span>
                          </a>
                        ) : Array.isArray(answer)
                          ? answer.join(", ") ||
                            "Não informado"
                          : answer || "Não informado"}
                      </dd>
                    </div>
                    );
                  })}
                </dl>
                <div className="lf-detail-actions">
                  <label>
                    Situação
                    <select
                      disabled={busy}
                      value={r.status}
                      onChange={(e) => void change(r, e.target.value)}
                    >
                      {Object.entries(responseStatuses).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        lock.current ||
                        !window.confirm(
                          "Excluir esta resposta permanentemente?",
                        )
                      )
                        return;
                      lock.current = true;
                      setBusy(true);
                      try {
                        await formsAction("response-delete", {
                          id: selected,
                          responseId: r.id,
                        });
                        await refresh();
                      } catch (e) {
                        setError(errorText(e));
                      } finally {
                        lock.current = false;
                        setBusy(false);
                      }
                    }}
                  >
                    <PanelMenuIcon name="trash" />
                    Excluir resposta
                  </button>
                </div>
              </div>
            )}
          </article>
        ))
      )}
      {count > 30 && (
        <div className="lf-pagination">
          <button
            disabled={page === 0 || loading}
            onClick={() => setPage((v) => v - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page + 1} de {Math.ceil(count / 30)}
          </span>
          <button
            disabled={(page + 1) * 30 >= count || loading}
            onClick={() => setPage((v) => v + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </section>
  );
}
