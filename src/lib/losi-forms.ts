import { supabase } from "./supabase";
export type FormFieldType =
  | "text"
  | "textarea"
  | "phone"
  | "email"
  | "date"
  | "number"
  | "select"
  | "multi";
export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: string[];
};
export type FormDraft = {
  title: string;
  description: string;
  template: string;
  fields: FormField[];
  audience: "public" | "suppliers" | "both";
  status: "draft" | "open" | "closed";
  notify: boolean;
};
export type LosiForm = FormDraft & {
  id: string;
  public_token: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type PublicForm = Pick<
  LosiForm,
  | "id"
  | "public_token"
  | "title"
  | "description"
  | "fields"
  | "audience"
  | "version"
> & { business_name: string };
export type FormAnswers = Record<string, string | string[]>;
export type FormResponse = {
  id: string;
  form_id: string;
  respondent_id: string | null;
  respondent_name: string;
  source: "public" | "supplier";
  answers: FormAnswers;
  definition: { title: string; fields: FormField[] };
  status: "new" | "review" | "approved" | "archived";
  created_at: string;
};
export type FormInvitation = {
  id: string;
  created_at: string;
  company: string;
  answered: boolean;
  form: Pick<LosiForm, "id" | "public_token" | "title" | "status" | "audience">;
};
export const fieldTypes: Record<FormFieldType, string> = {
  text: "Resposta curta",
  textarea: "Texto longo",
  phone: "Telefone / WhatsApp",
  email: "E-mail",
  date: "Data",
  number: "Número",
  select: "Uma opção",
  multi: "Várias opções",
};
export const responseStatuses: Record<FormResponse["status"], string> = {
  new: "Nova",
  review: "Em análise",
  approved: "Aprovada",
  archived: "Arquivada",
};
export const formStatuses: Record<LosiForm["status"], string> = {
  draft: "Rascunho",
  open: "Recebendo respostas",
  closed: "Encerrado",
};
const field = (
  label: string,
  type: FormFieldType = "text",
  required = false,
  options: string[] = [],
): FormField => ({ id: crypto.randomUUID(), label, type, required, options });
export const formTemplates = [
  { id: "proposal", name: "Solicitação de proposta" },
  { id: "event", name: "Eventos" },
  { id: "contact", name: "Solicitação de contato" },
  { id: "vacancy", name: "Pré-cadastro de vagas" },
  { id: "supplier", name: "Cadastro de fornecedores" },
  { id: "collaborator", name: "Cadastro de colaboradores" },
  { id: "free", name: "Formulário livre" },
];
export function createFormDraft(template = "proposal"): FormDraft {
  const common = [
    field("WhatsApp", "phone", true),
    field("E-mail", "email"),
    field("Cidade"),
  ];
  const settings: Record<
    string,
    { title: string; description: string; fields: FormField[] }
  > = {
    proposal: {
      title: "Vamos planejar seu evento?",
      description:
        "Conte o que você precisa. Entraremos em contato para preparar uma proposta.",
      fields: [
        ...common,
        field("Data do evento", "date"),
        field("Tipo de evento", "text", true),
        field("Quantidade de participantes", "number"),
        field("O que você está planejando?", "textarea", true),
      ],
    },
    event: {
      title: "Inscrição para o evento",
      description: "Preencha suas informações para participar do nosso evento.",
      fields: [...common, field("Empresa"), field("Observações", "textarea")],
    },
    contact: {
      title: "Vamos conversar?",
      description: "Deixe seu contato e conte como podemos ajudar.",
      fields: [
        ...common,
        field("Assunto", "text", true),
        field("Sua mensagem", "textarea", true),
      ],
    },
    vacancy: {
      title: "Faça seu pré-cadastro",
      description:
        "Conte sobre sua experiência e disponibilidade. O preenchimento não confirma uma vaga.",
      fields: [
        ...common,
        field("Nome de tio / nome profissional"),
        field("Função de interesse", "select", true, [
          "Recreador",
          "Monitor",
          "Coordenador",
          "Guia",
          "Animador",
          "Outra",
        ]),
        field("Experiência", "textarea"),
        field("Disponibilidade", "textarea", true),
      ],
    },
    supplier: {
      title: "Apresente sua empresa",
      description:
        "Queremos conhecer seus serviços e possibilidades de parceria.",
      fields: [
        field("Nome da empresa", "text", true),
        ...common,
        field("Serviços oferecidos", "textarea", true),
        field("Link do perfil público LOSI"),
      ],
    },
    collaborator: {
      title: "Queremos conhecer você",
      description: "Preencha seus dados para nossa seleção de colaboradores.",
      fields: [
        ...common,
        field("Nome de tio / nome profissional"),
        field("Experiência", "textarea", true),
        field("Disponibilidade", "textarea"),
      ],
    },
    free: {
      title: "Meu formulário",
      description: "",
      fields: [field("WhatsApp", "phone")],
    },
  };
  const chosen = settings[template] ?? settings.free;
  return {
    ...chosen,
    template,
    audience: "public",
    status: "draft",
    notify: true,
  };
}
export async function formsAction<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("losi-forms", {
    body: { action, ...body },
  });
  if (error) {
    let message = "Não foi possível concluir agora. Tente novamente.";
    try {
      const payload = await error.context?.json();
      if (payload?.error) message = payload.error;
    } catch {
      /* No response body. */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export const formLink = (
  form: Pick<LosiForm, "public_token">,
  supplier = false,
) =>
  window.location.origin +
  "/formulario/" +
  form.public_token +
  (supplier ? "?canal=fornecedor" : "");
export function supplierSlug(value: string) {
  try {
    const url = new URL(value.trim());
    if (
      ![
        "losiconecta.com.br",
        "www.losiconecta.com.br",
        window.location.hostname,
      ].includes(url.hostname)
    )
      throw new Error();
    const match = url.pathname.match(/^\/fornecedor\/([\w-]+)\/?$/);
    if (!match) throw new Error();
    return match[1];
  } catch {
    throw new Error(
      "Cole o link completo do perfil público do fornecedor na LOSI.",
    );
  }
}
