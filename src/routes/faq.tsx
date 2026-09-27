import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppLogo } from "../components/AppLogo";

export const Route = createFileRoute("/faq")({ component: FAQPage });

type Item = { q: string; a: string };
type Category = { title: string; description: string; items: Item[] };

const categories: Category[] = [
  { title: "Conta e acesso", description: "Cadastro, login e acesso às áreas do LOSI CONECTA.", items: [
    { q: "Preciso criar uma conta para pesquisar fornecedores?", a: "Não. A busca pública permite pesquisar e conhecer fornecedores sem login. Algumas ações e recursos exclusivos podem solicitar autenticação." },
    { q: "Como faço para criar minha conta?", a: "Acesse a área Entrar e escolha a opção de cadastro. Depois de confirmar seus dados, você poderá acessar os recursos disponíveis para o seu perfil." },
    { q: "Sou fornecedor. Preciso criar um perfil profissional?", a: "Sim. O perfil profissional reúne apresentação, serviços, portfólio, localização, formas de contato e outras informações que ajudam clientes a conhecer seu trabalho." },
    { q: "Posso sair da minha conta quando quiser?", a: "Sim. Use a opção Sair disponível na área autenticada. O logout encerra a sessão naquele navegador." },
  ]},
  { title: "Busca e fornecedores", description: "Entenda como encontrar profissionais para seu evento.", items: [
    { q: "O que posso encontrar no LOSI CONECTA?", a: "Profissionais e empresas que atuam em eventos, festas, recreação, monitoria, lazer, buffet, música, decoração, maquiagem e outras categorias cadastradas na plataforma." },
    { q: "Posso pesquisar por cidade e localização?", a: "Sim. A busca pode considerar termos, categoria, cidade e recursos de localização disponíveis, incluindo filtros por distância quando houver referência de localização." },
    { q: "Como vejo mais informações sobre um fornecedor?", a: "Abra o perfil público. Nele você pode conhecer apresentação, serviços, portfólio, avaliações, disponibilidade quando informada e formas de contato." },
    { q: "O LOSI CONECTA contrata o fornecedor por mim?", a: "Não. O LOSI CONECTA aproxima clientes e fornecedores. Negociação, contratação, valores, disponibilidade e condições do serviço são combinados diretamente entre as partes." },
  ]},
  { title: "Perfil profissional", description: "Como funciona a apresentação comercial de cada fornecedor.", items: [
    { q: "O que posso colocar no meu perfil?", a: "Informações profissionais, descrição da empresa, serviços, portfólio, localização, contatos, disponibilidade e avaliações, conforme os recursos habilitados para sua conta." },
    { q: "Posso atualizar meus serviços e informações?", a: "Sim. As informações do perfil profissional podem ser administradas pela área correspondente da sua conta, respeitando os recursos disponíveis para o seu plano." },
    { q: "O que significa o selo de fornecedor verificado?", a: "O selo faz parte do sistema de reputação e verificação do LOSI CONECTA. A plataforma utiliza critérios definidos para acompanhar a experiência e o histórico do fornecedor." },
  ]},
  { title: "Feed, curtidas e avaliações", description: "Recursos para mostrar trabalho e construir reputação.", items: [
    { q: "O que é o Feed?", a: "É o espaço de publicações dos fornecedores. Uma publicação feita pelo fornecedor pode aparecer no Feed geral e também no Feed pessoal do próprio fornecedor." },
    { q: "Para que serve a curtida no perfil?", a: "A curtida demonstra interesse pelo fornecedor e participa dos indicadores de engajamento do perfil. A quantidade de curtidas é exibida no perfil." },
    { q: "Como funcionam as avaliações?", a: "As avaliações permitem registrar a experiência com um fornecedor após um serviço e contribuem para os indicadores de reputação apresentados pela plataforma." },
    { q: "O que acontece quando um perfil alcança muitas curtidas?", a: "O LOSI CONECTA possui faixas de evolução visual do coração conforme a quantidade de curtidas. Ao alcançar o marco definido para o coração dourado, existe uma recompensa de destaque gratuito conforme as regras da plataforma." },
  ]},
  { title: "Orçamentos e contato", description: "Como iniciar uma conversa e solicitar uma proposta.", items: [
    { q: "Como entro em contato com um fornecedor?", a: "No perfil público você encontrará as formas de contato disponibilizadas pelo fornecedor, incluindo recursos internos e WhatsApp quando informado e disponível." },
    { q: "Posso solicitar um orçamento pelo LOSI CONECTA?", a: "Sim. Quando o recurso estiver disponível para o perfil, você pode iniciar uma solicitação de orçamento e informar os detalhes necessários para que o fornecedor responda." },
    { q: "O fornecedor recebe minha solicitação?", a: "Quando uma solicitação é enviada corretamente, ela fica disponível para o fornecedor responsável e pode gerar uma notificação na plataforma." },
    { q: "O LOSI CONECTA define o preço do serviço?", a: "Não. O valor e as condições comerciais são definidos entre cliente e fornecedor, de acordo com o serviço solicitado." },
  ]},
  { title: "Planos e pagamentos", description: "Informações sobre planos profissionais e contratação.", items: [
    { q: "O fornecedor precisa de um plano pago para aparecer no catálogo?", a: "A visibilidade comercial segue as regras dos planos disponíveis. Alguns recursos e níveis de destaque podem depender do plano contratado." },
    { q: "Como funciona o pagamento de um plano?", a: "A contratação é iniciada pela plataforma e o pagamento segue as opções apresentadas no momento da contratação. Durante a fase de testes, os pagamentos podem utilizar o ambiente sandbox do provedor." },
    { q: "Meu pagamento ficou pendente. O que faço?", a: "Confira a situação apresentada na sua conta e conclua o pagamento, quando necessário. A ativação do plano depende da confirmação do pagamento pelo sistema." },
    { q: "O plano é renovado automaticamente?", a: "No lançamento, a contratação não utiliza renovação automática. As regras de renovação podem ser alteradas futuramente e serão apresentadas pela plataforma." },
  ]},
  { title: "Notificações e segurança", description: "Alertas, privacidade e comunicação com a plataforma.", items: [
    { q: "Para que servem as notificações?", a: "Elas informam eventos relevantes da conta, como mensagens, curtidas, solicitações, atualizações e outras atividades relacionadas ao seu perfil." },
    { q: "Posso receber aviso sonoro?", a: "A plataforma possui suporte para alertas sonoros em determinadas notificações, respeitando as permissões e configurações do navegador ou dispositivo." },
    { q: "Encontrei um problema ou informação inadequada em um perfil. O que faço?", a: "Use o recurso de denúncia disponível no perfil quando ele estiver presente. A equipe responsável poderá analisar a ocorrência de acordo com as regras da plataforma." },
    { q: "Meus dados ficam públicos?", a: "Somente as informações destinadas à apresentação pública do fornecedor são exibidas no perfil público. Dados internos da conta e informações protegidas não devem ser expostos publicamente." },
  ]},
];

function FAQPage() {
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = categories.map(c => ({ ...c, items: c.items.filter(i => !term || [c.title,c.description,i.q,i.a].join(" ").toLocaleLowerCase("pt-BR").includes(term)) })).filter(c => c.items.length);

  return (
    <main className="losi-faq-page">
      <header className="losi-faq-header">
        <AppLogo aria-label="LOSI CONECTA">LOSI <span>CONECTA</span></AppLogo>
        <Link to="/buscar" className="losi-faq-back">Encontrar fornecedores</Link>
      </header>
      <section className="losi-faq-hero">
        <div className="losi-faq-hero-inner">
          <span className="losi-faq-kicker">CENTRAL DE AJUDA</span>
          <h1>Perguntas frequentes</h1>
          <p>Encontre respostas rápidas sobre o LOSI CONECTA, fornecedores, serviços, Feed, orçamentos, planos e muito mais.</p>
          <label className="losi-faq-search"><span aria-hidden="true">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite sua dúvida..." aria-label="Pesquisar na FAQ" /></label>
        </div>
      </section>
      <section className="losi-faq-content" aria-label="Perguntas frequentes">
        {!filtered.length ? <div className="losi-faq-empty"><strong>Nenhuma resposta encontrada.</strong><span>Tente pesquisar por outra palavra ou termo.</span></div> : filtered.map((c,ci) => (
          <section className="losi-faq-category" key={c.title}>
            <div className="losi-faq-category-head"><span className="losi-faq-category-number">{String(ci+1).padStart(2,"0")}</span><div><h2>{c.title}</h2><p>{c.description}</p></div></div>
            <div className="losi-faq-list">{c.items.map((item,ii) => {
              const key=c.title+ii; const isOpen=open===key;
              return <article className={"losi-faq-item"+(isOpen?" is-open":"")} key={key}>
                <button type="button" className="losi-faq-question" aria-expanded={isOpen} aria-controls={"faq-"+ii} onClick={() => setOpen(isOpen?null:key)}>
                  <span><b>{String(ii+1).padStart(2,"0")}</b>{item.q}</span><i aria-hidden="true">{isOpen?"−":"+"}</i>
                </button>
                {isOpen && <div id={"faq-"+ii} className="losi-faq-answer"><p>{item.a}</p></div>}
              </article>;
            })}</div>
          </section>
        ))}
      </section>
      <footer className="losi-faq-footer"><strong>LOSI CONECTA</strong><span>Encontre. Conheça. Conecte.</span><Link to="/buscar">Voltar para a busca</Link></footer>
    </main>
  );
}
