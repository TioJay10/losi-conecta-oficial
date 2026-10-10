import { useEffect, useRef, useState } from "react";
import { PanelMenuIcon } from "./PanelMenuIcon";
import "../work-planner.css";

type Brief = {
  title: string;
  kind: "work" | "business";
  description: string;
  category: string;
  client: string;
  city: string;
  state: string;
  date: string;
  duration: string;
  participants: string;
  audience: string;
  location: string;
  services: string[];
  team: string;
  budget: string;
  notes: string;
  document: "internal" | "commercial";
};
type Draft = { id: string; updatedAt: string; brief: Brief };
export type PlannerCategory = { id: string; name: string };
const blank = (): Brief => ({
  title: "",
  kind: "work",
  description: "",
  category: "",
  client: "",
  city: "",
  state: "",
  date: "",
  duration: "",
  participants: "",
  audience: "",
  location: "",
  services: [],
  team: "",
  budget: "",
  notes: "",
  document: "internal",
});
const steps = ["Demanda", "Evento", "Serviços", "Revisão"];
const money = (v: string) =>
  v
    ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "A definir";
const dateLabel = (v: string) =>
  v ? new Date(v + "T12:00:00").toLocaleDateString("pt-BR") : "A definir";
function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Draft;
  if (
    typeof d.id !== "string" ||
    typeof d.updatedAt !== "string" ||
    !d.brief ||
    typeof d.brief !== "object"
  )
    return false;
  return (
    Object.keys(blank()).every((key) =>
      key === "services"
        ? Array.isArray(d.brief.services) &&
          d.brief.services.every((s) => typeof s === "string")
        : typeof d.brief[key as keyof Brief] === "string",
    ) &&
    ["work", "business"].includes(d.brief.kind) &&
    ["internal", "commercial"].includes(d.brief.document)
  );
}
export function WorkPlanner({
  userId,
  categories,
  categoryError,
  onRetryCategories,
  onTalk,
}: {
  userId: string;
  categories: PlannerCategory[];
  categoryError?: string;
  onRetryCategories: () => void;
  onTalk?: (brief: string) => void;
}) {
  const [brief, setBrief] = useState<Brief>(blank);
  const [step, setStep] = useState(0);
  const [view, setView] = useState<"editor" | "drafts">("editor");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const [service, setService] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const storageKey = `losi-work-plans-v1:${userId}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (!Array.isArray(saved) || !saved.every(isDraft))
        throw new Error("invalid");
      setDrafts(saved);
    } catch {
      setStorageError(
        "Não foi possível carregar os rascunhos deste navegador. Seus dados não serão sobrescritos.",
      );
    }
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  function update<K extends keyof Brief>(key: K, value: Brief[K]) {
    setBrief((b) => ({ ...b, [key]: value }));
    setDirty(true);
    setReviewed(false);
    setMessage("");
  }
  function go(next: number) {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function save() {
    if (!ready || storageError) return;
    if (!brief.title.trim()) {
      setMessage("Dê um nome ao plano antes de salvar.");
      setView("editor");
      go(0);
      return;
    }
    const draft: Draft = {
      id: id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      brief,
    };
    const next = [draft, ...drafts.filter((d) => d.id !== draft.id)];
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setDrafts(next);
      setId(draft.id);
      setDirty(false);
      setMessage("Rascunho salvo neste dispositivo.");
    } catch {
      setMessage(
        "Não foi possível salvar. O armazenamento do navegador pode estar cheio ou indisponível.",
      );
    }
  }
  function mayReplace() {
    return (
      !dirty || window.confirm("Há alterações não salvas. Deseja descartá-las?")
    );
  }
  function newPlan() {
    if (!mayReplace()) return;
    setBrief(blank());
    setId(null);
    setDirty(false);
    setReviewed(false);
    setService("");
    setMessage("");
    setView("editor");
    go(0);
  }
  function example() {
    if (!mayReplace()) return;
    setBrief({
      ...blank(),
      title: "Festa da espuma",
      description:
        "Organizar uma festa da espuma para 80 crianças, com atividades recreativas e acompanhamento durante o evento.",
      city: "Cotia",
      state: "SP",
      duration: "4",
      participants: "80",
      audience: "Crianças",
      location: "Área externa",
      services: ["Festa da espuma", "Recreação infantil"],
      notes: "Confirmar idades, espaço disponível e participação simultânea.",
    });
    setId(null);
    setDirty(true);
    setReviewed(false);
    setView("editor");
    setMessage("Exemplo de preenchimento. Ajuste os dados para o seu evento.");
    go(0);
  }
  function addService() {
    const value = service.trim();
    if (!value) return;
    if (
      brief.services.some(
        (s) =>
          s.toLocaleLowerCase("pt-BR") === value.toLocaleLowerCase("pt-BR"),
      )
    ) {
      setMessage("Este serviço já foi adicionado.");
      return;
    }
    update("services", [...brief.services, value]);
    setService("");
  }
  const categoryName =
    categories.find((c) => c.id === brief.category)?.name || "A definir";
  const locationLabel =
    [brief.city, brief.state].filter(Boolean).join(" / ") || "A definir";
  const titles = [
    "O que você precisa planejar?",
    "Conte sobre o evento",
    "Defina o escopo do trabalho",
    "Revise antes de avançar",
  ];
  const descriptions = [
    "Comece pelo pedido do cliente. Os detalhes serão organizados nas próximas etapas.",
    "Essas informações serão a base para dimensionar a operação e pesquisar valores.",
    "Liste os serviços desejados e registre o que já tem disponível.",
    "Confira seu briefing e escolha como deseja apresentar o plano.",
  ];
  return (
    <div className="wp-page">
      <header className="wp-header">
        <div>
          <h1>Plano de trabalho</h1>
          <p>Da primeira ideia a um evento bem planejado.</p>
        </div>
        <button
          className="wp-button wp-outline"
          type="button"
          onClick={save}
          disabled={!ready || !!storageError}
        >
          <PanelMenuIcon name="forms" />
          Salvar rascunho
        </button>
      </header>
      {onTalk && <button className="wp-talk-lia" type="button" onClick={() => {
        onTalk(Object.entries({...brief, category: categoryName}).filter(([,value]) => Array.isArray(value) ? value.length : value).map(([key,value]) => `${({title:"Título",kind:"Tipo",description:"Pedido",category:"Nicho",client:"Cliente",city:"Cidade",state:"Estado",date:"Data",duration:"Duração em horas",participants:"Participantes",audience:"Público",location:"Espaço",services:"Serviços",team:"Equipe",budget:"Orçamento informado",notes:"Observações",document:"Documento"} as Record<string,string>)[key]}: ${Array.isArray(value)?value.join(", "):value}`).join("\n"));
      }}><PanelMenuIcon name="communication"/>Continuar este plano com a Lia</button>}
      <nav className="wp-views" aria-label="Área de planejamento">
        <button
          type="button"
          aria-current={view === "editor" ? "page" : undefined}
          onClick={() => setView("editor")}
        >
          <PanelMenuIcon name="activity" />
          Criar plano
        </button>
        <button
          type="button"
          aria-current={view === "drafts" ? "page" : undefined}
          onClick={() => setView("drafts")}
        >
          <PanelMenuIcon name="inbox" />
          Meus rascunhos <span>{drafts.length}</span>
        </button>
      </nav>
      {message && (
        <p className="wp-notice" role="status">
          {message}
        </p>
      )}
      {storageError && (
        <p className="wp-error" role="alert">
          {storageError}
        </p>
      )}
      {view === "drafts" ? (
        <section className="wp-drafts">
          <div className="wp-section-header">
            <div>
              <h2>Seu planejamento, sempre à mão</h2>
              <p>Rascunhos desta conta salvos neste dispositivo.</p>
            </div>
            <button className="wp-button wp-gold" onClick={newPlan}>
              <PanelMenuIcon name="plus" />
              Novo plano
            </button>
          </div>
          {!drafts.length ? (
            <div className="wp-empty">
              <PanelMenuIcon name="activity" />
              <h3>Seu próximo evento começa aqui</h3>
              <p>Crie um plano e salve o briefing para continuar depois.</p>
              <button
                className="wp-button wp-gold"
                onClick={() => setView("editor")}
              >
                Começar meu plano
              </button>
            </div>
          ) : (
            <ul className="wp-draft-list">
              {drafts.map((d) => (
                <li key={d.id}>
                  <button
                    className="wp-draft-open"
                    onClick={() => {
                      if (!mayReplace()) return;
                      setBrief(d.brief);
                      setId(d.id);
                      setDirty(false);
                      setReviewed(false);
                      setView("editor");
                      setMessage("");
                      go(0);
                    }}
                  >
                    <strong>{d.brief.title}</strong>
                    <span>
                      {[d.brief.city, d.brief.state]
                        .filter(Boolean)
                        .join(" / ") || "Local a definir"}{" "}
                      · Atualizado em{" "}
                      {new Date(d.updatedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </button>
                  <button
                    className="wp-button wp-outline"
                    aria-label={`Excluir rascunho ${d.brief.title}`}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Excluir o rascunho “${d.brief.title}” deste dispositivo?`,
                        )
                      )
                        return;
                      const next = drafts.filter((x) => x.id !== d.id);
                      try {
                        localStorage.setItem(storageKey, JSON.stringify(next));
                        setDrafts(next);
                        if (id === d.id) {
                          setId(null);
                          setDirty(true);
                        }
                      } catch {
                        setMessage("Não foi possível excluir o rascunho.");
                      }
                    }}
                  >
                    <PanelMenuIcon name="trash" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <div className="wp-intro">
            <span>
              <PanelMenuIcon name="activity" />
              Planejamento em etapas
            </span>
            <button type="button" onClick={example}>
              Experimentar com um exemplo <PanelMenuIcon name="eye" />
            </button>
          </div>
          <nav className="wp-steps" aria-label="Etapas do plano">
            {steps.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-current={step === i ? "step" : undefined}
                className={step === i ? "active" : ""}
                onClick={() => {
                  if (i > step && !form.current?.reportValidity()) return;
                  go(i);
                }}
              >
                <span className="wp-step-number">
                  {i < step ? <PanelMenuIcon name="check" /> : i + 1}
                </span>
                <span>{label}</span>
                {step === i && <span className="wp-step-state">Em edição</span>}
              </button>
            ))}
          </nav>
          <div className="wp-layout">
            <section className="wp-editor" aria-label="Preenchimento do plano">
              <div className="wp-editor-heading">
                <span className="wp-step-caption">Etapa {step + 1} de 4</span>
                <h2 ref={heading} tabIndex={-1}>
                  {titles[step]}
                </h2>
                <p>{descriptions[step]}</p>
              </div>
              <form
                ref={form}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step < 3) go(step + 1);
                  else {
                    setReviewed(true);
                    save();
                  }
                }}
              >
                <div className="wp-step-content" key={step}>
                  {step === 0 && (
                    <>
                      <fieldset className="wp-kind">
                        <legend>Tipo de planejamento</legend>
                        <div>
                          {[
                            {
                              value: "work",
                              label: "Plano de trabalho",
                              hint: "Executar um evento ou serviço",
                              icon: "activity",
                            },
                            {
                              value: "business",
                              label: "Plano de negócios",
                              hint: "Organizar sua oferta de serviços",
                              icon: "commercial",
                            },
                          ].map((option) => (
                            <label
                              key={option.value}
                              className={
                                brief.kind === option.value ? "selected" : ""
                              }
                            >
                              <input
                                type="radio"
                                name="plan-kind"
                                checked={brief.kind === option.value}
                                onChange={() =>
                                  update("kind", option.value as Brief["kind"])
                                }
                              />
                              <PanelMenuIcon name={option.icon} />
                              <span>
                                <strong>{option.label}</strong>
                                <small>{option.hint}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label className="wp-field">
                        Nome do plano <span>Obrigatório</span>
                        <input
                          required
                          maxLength={120}
                          value={brief.title}
                          onChange={(e) => update("title", e.target.value)}
                          placeholder="Ex.: Evento corporativo de fim de ano"
                        />
                      </label>
                      <label className="wp-field">
                        Descreva o que o cliente precisa{" "}
                        <span>Obrigatório</span>
                        <textarea
                          required
                          minLength={10}
                          maxLength={5000}
                          rows={5}
                          value={brief.description}
                          onChange={(e) =>
                            update("description", e.target.value)
                          }
                          placeholder="Conte o objetivo, as atividades solicitadas e o que você precisa entregar…"
                        />
                        <small>
                          Inclua o que já sabe. Você poderá completar o briefing
                          depois.
                        </small>
                      </label>
                      <label className="wp-field">
                        Nicho principal
                        <select
                          value={brief.category}
                          onChange={(e) => update("category", e.target.value)}
                        >
                          <option value="">Escolha o nicho do serviço</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {categoryError && (
                        <p className="wp-inline-error" role="alert">
                          {categoryError}{" "}
                          <button type="button" onClick={onRetryCategories}>
                            Tentar novamente
                          </button>
                        </p>
                      )}
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <label className="wp-field">
                        Cliente ou empresa
                        <input
                          maxLength={160}
                          value={brief.client}
                          onChange={(e) => update("client", e.target.value)}
                          placeholder="Para quem será o planejamento?"
                        />
                      </label>
                      <div className="wp-field-grid">
                        <label className="wp-field">
                          Cidade
                          <input
                            maxLength={120}
                            value={brief.city}
                            onChange={(e) => update("city", e.target.value)}
                            placeholder="Ex.: Cotia"
                          />
                        </label>
                        <label className="wp-field">
                          Estado
                          <select
                            value={brief.state}
                            onChange={(e) => update("state", e.target.value)}
                          >
                            <option value="">Selecione</option>
                            {"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
                              .split(" ")
                              .map((uf) => (
                                <option key={uf}>{uf}</option>
                              ))}
                          </select>
                        </label>
                        <label className="wp-field">
                          Data do evento
                          <input
                            type="date"
                            value={brief.date}
                            onChange={(e) => update("date", e.target.value)}
                          />
                        </label>
                        <label className="wp-field">
                          Duração estimada (horas)
                          <input
                            type="number"
                            min="0.5"
                            max="10000"
                            step="0.5"
                            value={brief.duration}
                            onChange={(e) => update("duration", e.target.value)}
                            placeholder="Ex.: 4"
                          />
                        </label>
                        <label className="wp-field">
                          Quantidade de participantes
                          <input
                            type="number"
                            min="1"
                            max="1000000"
                            step="1"
                            value={brief.participants}
                            onChange={(e) =>
                              update("participants", e.target.value)
                            }
                            placeholder="Ex.: 80"
                          />
                        </label>
                        <label className="wp-field">
                          Perfil do público
                          <input
                            maxLength={160}
                            value={brief.audience}
                            onChange={(e) => update("audience", e.target.value)}
                            placeholder="Idades, necessidades e perfil"
                          />
                        </label>
                      </div>
                      <label className="wp-field">
                        Espaço e estrutura disponíveis
                        <textarea
                          maxLength={2000}
                          rows={3}
                          value={brief.location}
                          onChange={(e) => update("location", e.target.value)}
                          placeholder="Área interna ou externa, tamanho, energia, acesso, restrições…"
                        />
                      </label>
                      <p className="wp-tip">
                        <PanelMenuIcon name="eye" />
                        Se algum detalhe ainda não foi definido, deixe o campo
                        em branco.
                      </p>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <label className="wp-field" htmlFor="wp-service">
                        Serviços que serão oferecidos
                      </label>
                      <div className="wp-add-service">
                        <input
                          id="wp-service"
                          value={service}
                          maxLength={120}
                          onChange={(e) => setService(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addService();
                            }
                          }}
                          placeholder="Ex.: buffet, decoração ou recreação"
                        />
                        <button
                          type="button"
                          className="wp-button wp-gold"
                          onClick={addService}
                          disabled={!service.trim()}
                        >
                          <PanelMenuIcon name="plus" />
                          Adicionar
                        </button>
                      </div>
                      <ul className="wp-services">
                        {brief.services.map((s) => (
                          <li key={s}>
                            <span>{s}</span>
                            <button
                              type="button"
                              aria-label={`Remover ${s}`}
                              onClick={() =>
                                update(
                                  "services",
                                  brief.services.filter((x) => x !== s),
                                )
                              }
                            >
                              <PanelMenuIcon name="close" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      {!brief.services.length && (
                        <p className="wp-field-hint">
                          Adicione os serviços para organizar o escopo do
                          evento.
                        </p>
                      )}
                      <label className="wp-field">
                        Equipe e equipamentos que você já tem
                        <textarea
                          rows={3}
                          maxLength={3000}
                          value={brief.team}
                          onChange={(e) => update("team", e.target.value)}
                          placeholder="Profissionais disponíveis, materiais e equipamentos próprios…"
                        />
                      </label>
                      <label className="wp-field">
                        Orçamento disponível (R$)
                        <input
                          type="number"
                          min="0"
                          max="100000000"
                          step="0.01"
                          value={brief.budget}
                          onChange={(e) => update("budget", e.target.value)}
                          placeholder="Opcional — informe se já houver um limite"
                        />
                        <small>
                          Valor informado por você. Não representa uma cotação
                          de mercado.
                        </small>
                      </label>
                      <label className="wp-field">
                        Observações e prioridades
                        <textarea
                          rows={3}
                          maxLength={3000}
                          value={brief.notes}
                          onChange={(e) => update("notes", e.target.value)}
                          placeholder="Pontos de atenção, prazos e o que é indispensável…"
                        />
                      </label>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <div className="wp-review-title">
                        <h3>{brief.title || "Plano sem nome"}</h3>
                        <button type="button" onClick={() => go(0)}>
                          Editar demanda
                        </button>
                      </div>
                      <p className="wp-review-description">
                        {brief.description ||
                          "Descreva a demanda na primeira etapa."}
                      </p>
                      <dl className="wp-review-facts">
                        <div>
                          <dt>Cliente</dt>
                          <dd>{brief.client || "A definir"}</dd>
                        </div>
                        <div>
                          <dt>Local e data</dt>
                          <dd>
                            {locationLabel} · {dateLabel(brief.date)}
                          </dd>
                        </div>
                        <div>
                          <dt>Público e duração</dt>
                          <dd>
                            {brief.participants
                              ? `${brief.participants} participantes`
                              : "Público a definir"}
                            {brief.duration ? ` · ${brief.duration} horas` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt>Orçamento informado</dt>
                          <dd>{money(brief.budget)}</dd>
                        </div>
                      </dl>
                      {brief.services.length > 0 && (
                        <div className="wp-review-services">
                          <h3>Serviços previstos</h3>
                          <ul>
                            {brief.services.map((s) => (
                              <li key={s}>
                                <PanelMenuIcon name="check" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(brief.audience ||
                        brief.location ||
                        brief.team ||
                        brief.notes) && (
                        <dl className="wp-review-facts">
                          {[
                            {
                              label: "Perfil do público",
                              value: brief.audience,
                            },
                            {
                              label: "Espaço e estrutura",
                              value: brief.location,
                            },
                            {
                              label: "Equipe e equipamentos disponíveis",
                              value: brief.team,
                            },
                            {
                              label: "Observações e prioridades",
                              value: brief.notes,
                            },
                          ]
                            .filter((item) => item.value)
                            .map((item) => (
                              <div key={item.label}>
                                <dt>{item.label}</dt>
                                <dd>{item.value}</dd>
                              </div>
                            ))}
                        </dl>
                      )}
                      <fieldset className="wp-document-picker">
                        <legend>Apresentação do documento</legend>
                        <p>
                          Escolha a versão para visualizar a estrutura do seu
                          plano.
                        </p>
                        <div>
                          {[
                            {
                              value: "internal",
                              label: "Plano interno",
                              hint: "Operação, equipe e custos",
                              icon: "activity",
                            },
                            {
                              value: "commercial",
                              label: "Proposta ao cliente",
                              hint: "Serviços e apresentação",
                              icon: "proposals",
                            },
                          ].map((option) => (
                            <label
                              key={option.value}
                              className={
                                brief.document === option.value
                                  ? "selected"
                                  : ""
                              }
                            >
                              <input
                                type="radio"
                                name="document"
                                checked={brief.document === option.value}
                                onChange={() =>
                                  update(
                                    "document",
                                    option.value as Brief["document"],
                                  )
                                }
                              />
                              <PanelMenuIcon name={option.icon} />
                              <span>
                                <strong>{option.label}</strong>
                                <small>{option.hint}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <p className="wp-tip">
                        <PanelMenuIcon name="forms" />A geração de PDF nos
                        modelos da LOSI estará disponível em breve.
                      </p>
                      {reviewed && (
                        <p className="wp-reviewed" role="status">
                          <PanelMenuIcon name="check" />
                          Briefing revisado. Seu planejamento está preparado
                          para continuar.
                        </p>
                      )}
                    </>
                  )}
                </div>
                <footer className="wp-form-footer">
                  <button
                    type="button"
                    className="wp-button wp-back"
                    disabled={step === 0}
                    onClick={() => go(step - 1)}
                  >
                    <PanelMenuIcon name="back" />
                    Voltar
                  </button>
                  <span>
                    {dirty
                      ? "Alterações não salvas"
                      : id
                        ? "Rascunho salvo"
                        : "Seu novo planejamento"}
                  </span>
                  <button type="submit" className="wp-button wp-gold">
                    {step === 3 ? "Revisar e salvar" : "Continuar"}
                    <PanelMenuIcon name={step === 3 ? "check" : "send"} />
                  </button>
                </footer>
              </form>
            </section>
            <aside className="wp-summary" aria-label="Resumo do planejamento">
              <div className="wp-summary-top">
                <h2>Seu plano começa a tomar forma</h2>
                <p>O resumo acompanha cada detalhe que você adiciona.</p>
              </div>
              <div className="wp-paper">
                <div className="wp-paper-brand">
                  <strong>LOSI</strong>
                  <span>CONECTA</span>
                  <PanelMenuIcon
                    name={
                      brief.document === "internal" ? "activity" : "proposals"
                    }
                  />
                </div>
                <span className="wp-paper-type">
                  {brief.document === "internal"
                    ? brief.kind === "business"
                      ? "Plano de negócios"
                      : "Plano de trabalho"
                    : "Proposta comercial"}
                </span>
                <h3>{brief.title || "Seu próximo projeto"}</h3>
                <p>
                  {brief.client
                    ? `Preparado para ${brief.client}`
                    : "Um bom plano começa com um objetivo claro."}
                </p>
                <dl>
                  <div>
                    <dt>Nicho</dt>
                    <dd>{categoryName}</dd>
                  </div>
                  <div>
                    <dt>Local</dt>
                    <dd>{locationLabel}</dd>
                  </div>
                  <div>
                    <dt>Data</dt>
                    <dd>{dateLabel(brief.date)}</dd>
                  </div>
                  <div>
                    <dt>Público</dt>
                    <dd>
                      {brief.participants
                        ? `${brief.participants} participantes`
                        : "A definir"}
                    </dd>
                  </div>
                </dl>
                <div className="wp-paper-services">
                  <strong>Serviços no escopo</strong>
                  {brief.services.length ? (
                    <ul>
                      {brief.services.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>Os serviços adicionados aparecerão aqui.</p>
                  )}
                </div>
                <div className="wp-paper-foot">
                  {brief.document === "internal"
                    ? "Documento de planejamento interno"
                    : "Apresentação para o cliente"}
                  <span>Prévia do briefing</span>
                </div>
              </div>
              <div className="wp-next">
                <h3>Planejamento com IA</h3>
                <p>Em breve, o assistente ajudará a organizar:</p>
                <ul>
                  <li>
                    <PanelMenuIcon name="users" />
                    <span>Equipe e fornecedores LOSI</span>
                  </li>
                  <li>
                    <PanelMenuIcon name="search" />
                    <span>Pesquisa de preços na internet, com fontes</span>
                  </li>
                  <li>
                    <PanelMenuIcon name="proposals" />
                    <span>Plano e proposta em PDF</span>
                  </li>
                </ul>
                <span className="wp-coming">Integrações em breve</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
