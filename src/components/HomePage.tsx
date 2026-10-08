import "../home-asaas.css";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import { AppLogo } from "./AppLogo";
import { supabase } from "../lib/supabase";

export type HomeCustomization = {
  hero_title: string;
  hero_subtitle: string;
  hero_button_text: string;
  color_background: string;
  color_primary: string;
  color_secondary: string;
  color_text: string;
  color_button: string;
  color_button_text: string;
};

export const DEFAULT_HOME_CUSTOMIZATION: HomeCustomization = {
  hero_title: "",
  hero_subtitle: "",
  hero_button_text: "",
  color_background: "#ffffff",
  color_primary: "#8a6d2f",
  color_secondary: "#d6b46a",
  color_text: "#1d1d1f",
  color_button: "#163dd9",
  color_button_text: "#ffffff",
};

export function HomePage({
  customizationOverride,
  preview = false,
}: {
  customizationOverride?: Partial<HomeCustomization>;
  preview?: boolean;
}) {
  const [customization, setCustomization] = useState<HomeCustomization>(DEFAULT_HOME_CUSTOMIZATION);

  useEffect(() => {
    if (customizationOverride) return;
    let mounted = true;

    async function loadCustomization() {
      const { data } = await supabase.from("home_customization_settings").select("key,value");
      if (!mounted) return;

      const values = Object.fromEntries((data ?? []).map((item) => [item.key, item.value]));
      setCustomization((current) => ({
        ...current,
        hero_title: values.hero_title ?? "",
        hero_subtitle: values.hero_subtitle ?? "",
        hero_button_text: values.hero_button_text ?? "",
        color_background: values.color_background || current.color_background,
        color_primary: values.color_primary || current.color_primary,
        color_secondary: values.color_secondary || current.color_secondary,
        color_text: values.color_text || current.color_text,
        color_button: values.color_button || current.color_button,
        color_button_text: values.color_button_text || current.color_button_text,
      }));
    }

    void loadCustomization();
    return () => {
      mounted = false;
    };
  }, [customizationOverride]);

  const active = { ...customization, ...customizationOverride };

  const [email, setEmail] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [connected, setConnected] = useState(true);
  const [tool, setTool] = useState(0);
  const style = {
    "--lh-background": active.color_background,
    "--lh-ink": active.color_text,
    "--lh-button": active.color_button,
    "--lh-button-text": active.color_button_text,
    "--lh-gold": active.color_secondary,
    "--lh-gold-dark": active.color_primary,
  } as CSSProperties;
  function beginSignup(event: FormEvent) {
    event.preventDefault();
    try { sessionStorage.setItem("losi-signup-email", email.trim()); } catch { /* The registration page also accepts manual entry. */ }
    window.location.assign("/entrar?mode=signup");
  }
  const tools = [
    { title: "Apresente seu trabalho", description: "Crie propostas comerciais, organize seus serviços e gere materiais em PDF. A LIA ajuda você a escrever o conteúdo.", items: ["Propostas comerciais", "Orçamentos", "Materiais com IA"], heading: "Sua próxima proposta", rows: ["Apresentação dos serviços", "Atividades para o evento", "Conteúdo e layout em PDF"] },
    { title: "Organize sua equipe", description: "Reúna sua rede de colaboradores, publique oportunidades e acompanhe as escalas pelo calendário pessoal de cada participante.", items: ["Rede de colaboradores", "Eventos e escalas", "Calendário pessoal"], heading: "Sua operação organizada", rows: ["Crie o evento e as vagas", "Defina a equipe e as funções", "Acompanhe as confirmações"] },
    { title: "Amplie suas conexões", description: "Divulgue seu perfil, anuncie no LOSI ADS e converse com outros fornecedores pelo Chat LOSI, com número digital e créditos próprios.", items: ["Perfil público", "LOSI ADS", "Chat de fornecedores"], heading: "Sua rede profissional", rows: ["Seu negócio na busca", "Oportunidades e anúncios", "Conversas e networking"] },
  ];
  return <main className={`losi-home${preview ? " losi-home-preview" : ""}`} style={style}>
    <div className="lh-intro">
      <header className="lh-header">
        <AppLogo className="lh-brand"><img src="/losi-conecta-symbol.svg" alt=""/><span>LOSI <b>CONECTA</b></span></AppLogo>
        <button className="lh-menu-toggle" type="button" aria-label={navOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={navOpen} aria-controls="lh-navigation" onClick={()=>setNavOpen(!navOpen)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={navOpen ? "m5 5 14 14M19 5 5 19" : "M3 6h18M3 12h18M3 18h18"}/></svg></button>
        <nav id="lh-navigation" className={navOpen ? "lh-navigation is-open" : "lh-navigation"} aria-label="Navegação principal" onClick={()=>setNavOpen(false)}>
          <a href="#solucoes">Soluções</a><a href="#como-funciona">Como funciona</a><a href="#categorias">Fornecedores</a><Link to="/faq">Ajuda</Link>
          <Link to="/entrar" className="lh-login">Acessar minha conta</Link><a href="/entrar?mode=signup" className="lh-header-signup">Criar minha conta</a>
        </nav>
      </header>
      <section className="lh-hero">
        <div className="lh-hero-copy">
          <h1>{active.hero_title || "Tudo para o seu evento. Em um só lugar."}</h1>
          <p>{active.hero_subtitle || "Encontre fornecedores, apresente seu trabalho, organize sua equipe e crie novas conexões. Do primeiro contato ao próximo evento."}</p>
          <form className="lh-signup" onSubmit={beginSignup}>
            <h2>Faça parte da LOSI Conecta!</h2><label className="lh-sr-only" htmlFor="lh-email">Seu e-mail</label>
            <input id="lh-email" type="email" autoComplete="email" placeholder="Preencha seu e-mail" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={254}/>
            <button type="submit">Criar minha conta</button><small>Continue para completar seu cadastro. Você escolhe os recursos que quer utilizar.</small>
          </form>
          <Link to="/buscar" className="lh-hero-search">{active.hero_button_text || "Quero encontrar fornecedores"}<Arrow/></Link>
        </div>
        <div className="lh-hero-people"><img src="/home-event-professionals.webp" alt="Dois profissionais de eventos sorrindo, com uniformes azul e lilás" width="1448" height="1086" fetchPriority="high"/></div>
      </section>
    </div>
    <section id="como-funciona" className="lh-section lh-comparison">
      <h2>Aqui seu evento tem as conexões<br className="lh-desktop-break"/> que precisa em um só lugar</h2>
      <div className="lh-switch" aria-label="Comparar organização do evento"><button type="button" aria-pressed={!connected} onClick={()=>setConnected(false)}>Sem a LOSI</button><button type="button" aria-pressed={connected} onClick={()=>setConnected(true)}>Com a LOSI</button></div>
      <div className={`lh-workflow ${connected ? "is-connected" : ""}`} aria-live="polite">
        <div className="lh-workflow-center"><img src="/losi-conecta-symbol.svg" alt=""/><strong>{connected ? "Seu evento conectado" : "Tudo separado"}</strong><p>{connected ? "Encontre. Organize. Conecte." : "Contatos, arquivos e informações dispersos."}</p></div>
        <div className="lh-workflow-steps">{(connected ? ["Encontre fornecedores na busca", "Conheça os perfis e serviços", "Converse e apresente sua proposta", "Organize os eventos e sua equipe"] : ["Procure contatos em diferentes lugares", "Peça informações individualmente", "Reúna arquivos e apresentações", "Confira a equipe em várias conversas"]).map((text,i)=><div key={text}><span>{i+1}</span><p>{text}</p></div>)}</div>
      </div>
      <Link to="/buscar" className="lh-primary">Encontrar fornecedores<Arrow/></Link>
    </section>
    <section id="solucoes" className="lh-section lh-solutions">
      <h2>Faça tudo com sua plataforma de eventos.<br className="lh-desktop-break"/> Do seu jeito.</h2>
      <div className="lh-tools-tabs" aria-label="Recursos da plataforma">{tools.map((item,i)=><button key={item.title} type="button" aria-pressed={tool===i} onClick={()=>setTool(i)}>{item.title}</button>)}</div>
      <div className="lh-tool-content">
        <div className="lh-demo" aria-label="Demonstração ilustrativa dos recursos"><div className="lh-demo-top"><img src="/losi-conecta-symbol.svg" alt=""/><strong>LOSI CONECTA</strong><span>Prévia ilustrativa</span></div><div className="lh-demo-body"><h3>{tools[tool].heading}</h3>{tools[tool].rows.map((text,i)=><div className="lh-demo-row" key={text}><Check/><span>{text}</span><span className="lh-demo-tag">{i===2 ? "Tudo pronto" : "Organizado"}</span></div>)}</div><div className="lh-demo-bottom">Seu trabalho merece uma apresentação profissional.</div></div>
        <div className="lh-tool-copy"><h3>{tools[tool].title}</h3><p>{tools[tool].description}</p><ul>{tools[tool].items.map(text=><li key={text}><Check/>{text}</li>)}</ul><Link to="/entrar" className="lh-primary">Conhecer os recursos<Arrow/></Link></div>
      </div>
    </section>
    <section id="categorias" className="lh-section lh-categories"><h2>Encontre quem faz<br/> seu evento acontecer</h2><p>Profissionais e empresas para diferentes momentos e necessidades.</p><div className="lh-category-links">{["Recreação e entretenimento","Monitoria","Fotografia e vídeo","DJ e música","Decoração","Buffet e alimentação","Atrações","Estruturas e equipamentos"].map(text=><Link to="/buscar" key={text}>{text}<Arrow/></Link>)}</div><Link to="/buscar" className="lh-primary">Explorar fornecedores<Arrow/></Link></section>
    <section id="para-quem" className="lh-audience"><div className="lh-section lh-audience-inner"><div><h2>Você cuida do evento.<br/> A gente aproxima as pessoas.</h2><p>Para quem organiza uma festa, produz uma experiência ou oferece um serviço: uma rede para dar o próximo passo.</p><div className="lh-audience-row"><h3>Para organizadores</h3><p>Pesquise por categoria e localização, conheça os perfis e fale diretamente com os fornecedores.</p></div><div className="lh-audience-row"><h3>Para fornecedores</h3><p>Mostre seus serviços, compartilhe seu perfil e reúna as ferramentas da sua operação em um painel.</p></div><a href="/entrar?mode=signup" className="lh-primary">Começar agora<Arrow/></a></div><div className="lh-audience-photo"><img src="https://images.unsplash.com/photo-1620177088260-a9150572baf4?auto=format&fit=crop&w=1000&q=85" alt="Ambiente preparado para um evento" loading="lazy" width="1000" height="1100"/></div></div></section>
    <section className="lh-section lh-mobile-section"><div><h2>Sua próxima conexão<br/> também está no celular</h2><p>Pesquise fornecedores e acompanhe sua operação onde estiver. A LOSI Conecta se adapta ao seu dia a dia.</p><Link to="/buscar" className="lh-primary">Acessar a plataforma<Arrow/></Link></div><div className="lh-mobile-preview"><img src="/losi-conecta-symbol.svg" alt=""/><strong>LOSI CONECTA</strong><span>Eventos · Profissionais · Conexões</span><Link to="/buscar">Encontrar fornecedores<Arrow/></Link><Link to="/entrar">Acessar meu painel<Arrow/></Link></div></section>
    <section className="lh-section lh-faq"><h2>Alguma dúvida?</h2>{[
      ["Como faço para criar minha conta?","Informe seu e-mail no início desta página e complete seu cadastro. Depois, acesse o painel para configurar seu perfil e sua empresa."],
      ["Preciso de conta para buscar fornecedores?","Você pode explorar a busca e os perfis públicos para conhecer os serviços e encontrar fornecedores."],
      ["Como converso com um fornecedor?","Abra o perfil público e utilize os contatos disponibilizados pelo profissional. O Chat LOSI é um recurso separado, com número digital e créditos."],
      ["A LOSI oferece ferramentas para minha equipe?","Sim. Em Equipe & Escalas, você pode organizar eventos, oportunidades e colaboradores. Os participantes acompanham as informações pelo calendário pessoal."],
      ["Todos os recursos estão incluídos no cadastro?","A disponibilidade depende do recurso e do plano. Anúncios, geração com IA e Chat LOSI podem utilizar franquias ou créditos próprios. Consulte as condições no painel."],
    ].map(([question,answer])=><details key={question}><summary>{question}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14"/></svg></summary><p>{answer}</p></details>)}<p>Ainda precisa de ajuda? <Link to="/faq">Veja as perguntas frequentes<Arrow/></Link></p></section>
    <section className="lh-final"><h2>Seu próximo evento começa<br/> com uma boa conexão.</h2><a href="/entrar?mode=signup" className="lh-primary">Criar minha conta<Arrow/></a></section>
    <footer className="lh-footer lh-section"><div className="lh-footer-grid"><div><AppLogo className="lh-brand"><img src="/losi-conecta-symbol.svg" alt=""/><span>LOSI <b>CONECTA</b></span></AppLogo><p>Eventos, profissionais e oportunidades.<br/> Tudo mais próximo.</p></div><div><h3>Plataforma</h3><a href="#solucoes">Soluções</a><a href="#como-funciona">Como funciona</a><a href="#para-quem">Para quem é</a></div><div><h3>Comece por aqui</h3><Link to="/buscar">Buscar fornecedores</Link><a href="/entrar?mode=signup">Criar conta</a><Link to="/entrar">Entrar</Link></div><div><h3>Ajuda</h3><Link to="/faq">Perguntas frequentes</Link><a href="#categorias">Categorias de serviços</a></div></div><div className="lh-copyright">© {new Date().getFullYear()} LOSI CONECTA. Todos os direitos reservados.</div></footer>
  </main>;
}
function Arrow(){return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;}
function Check(){return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>;}
