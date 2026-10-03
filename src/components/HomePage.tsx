import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
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
  color_background: "#f5f5f7",
  color_primary: "#8a6d2f",
  color_secondary: "#d6b46a",
  color_text: "#1d1d1f",
  color_button: "#0b182a",
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
      }));
    }

    void loadCustomization();
    return () => {
      mounted = false;
    };
  }, [customizationOverride]);

  const active = { ...customization, ...customizationOverride };

  const themeStyle = {
    "--home-bg": active.color_background || DEFAULT_HOME_CUSTOMIZATION.color_background,
    "--home-gold": active.color_primary || DEFAULT_HOME_CUSTOMIZATION.color_primary,
    "--home-gold-light": active.color_secondary || DEFAULT_HOME_CUSTOMIZATION.color_secondary,
    "--home-text": active.color_text || DEFAULT_HOME_CUSTOMIZATION.color_text,
    "--home-navy": active.color_button || DEFAULT_HOME_CUSTOMIZATION.color_button,
    "--home-button-text": active.color_button_text || DEFAULT_HOME_CUSTOMIZATION.color_button_text,
  } as CSSProperties;

  return (
    <main className={`home-page home-apple-inspired${preview ? " home-page-preview" : ""}`} style={themeStyle}>
      <header className="home-header home-apple-header">
        <AppLogo className="home-brand-link home-brand" aria-label="LOSI CONECTA">
          <img
            className="home-brand-symbol"
            src="/losi-conecta-symbol.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="home-brand-name">LOSI CONECTA</span>
        </AppLogo>

        <nav className="home-nav home-apple-nav" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#para-quem">Para quem é</a>
          <a href="#categorias">Categorias</a>
        </nav>

        <div className="home-header-actions">
          <Link to="/buscar" className="home-header-search">Buscar</Link>
          <Link to="/entrar" className="home-header-login">Entrar</Link>
        </div>
      </header>

      <section className="home-apple-hero">
        <div className="home-hero-copy">
          <p className="home-eyebrow">LOSI CONECTA</p>
          <h1>{active.hero_title || "Tudo para o seu evento. Em um só lugar."}</h1>
          <p className="home-hero-lead">
            {active.hero_subtitle ||
              "Encontre profissionais, empresas e fornecedores para transformar ideias em experiências."}
          </p>
          <div className="home-hero-links">
            <Link to="/buscar" className="home-blue-link">
              {active.hero_button_text || "Encontrar fornecedores"} <span>›</span>
            </Link>
            <a href="#como-funciona" className="home-hero-text-link">
              Como funciona <span>›</span>
            </a>
          </div>
        </div>

        <div className="home-hero-panel">
          <div className="home-hero-panel-media" aria-hidden="true">
            <img
              src="https://images.unsplash.com/photo-1768508665663-fa483a0cb208?auto=format&fit=crop&w=1800&q=85"
              alt=""
              loading="eager"
              decoding="async"
            />
          </div>
          <div className="home-hero-panel-content">
            <span>ENCONTRE</span>
            <strong>Profissionais para o seu próximo evento.</strong>
            <p>Recreação, monitoria, música, decoração, buffet, atrações e muito mais.</p>
          </div>
          <Link to="/buscar" className="home-panel-text-link">Explorar fornecedores <span>›</span></Link>
        </div>
      </section>

      <section id="como-funciona" className="home-feature-grid">
        <article className="home-feature-card home-feature-card-dark">
          <div className="home-feature-image">
            <img
              src="https://images.unsplash.com/photo-1712904124132-857e6577aab9?auto=format&fit=crop&fm=jpg&q=85&w=1600"
              alt="Pessoa participando de um evento virtual usando um computador"
              loading="lazy"
              decoding="async"
            />
          </div>
          <span>01 — ENCONTRE</span>
          <h2>Pesquise pelo que seu evento precisa.</h2>
          <p>Filtre por serviço, categoria e localização e encontre profissionais disponíveis para atender seu projeto.</p>
        </article>

        <article className="home-feature-card home-feature-card-light">
          <div className="home-feature-image">
            <img
              src="https://images.unsplash.com/photo-1769839271487-c6a191548749?auto=format&fit=crop&fm=jpg&q=85&w=1600"
              alt="Profissionais conversando durante um evento"
              loading="lazy"
              decoding="async"
            />
          </div>
          <span>02 — CONHEÇA</span>
          <h2>Veja quem está por trás do serviço.</h2>
          <p>Conheça o perfil público, serviços, informações e presença profissional antes de entrar em contato.</p>
        </article>

        <article className="home-feature-card home-feature-card-gold">
          <div className="home-feature-image">
            <img
              src="https://images.unsplash.com/photo-1768508665663-fa483a0cb208?auto=format&fit=crop&w=1800&q=85"
              alt="Profissionais e participantes reunidos em um evento"
              loading="lazy"
              decoding="async"
            />
          </div>
          <span>03 — CONECTE</span>
          <h2>Converse diretamente com o fornecedor.</h2>
          <p>Depois de encontrar o profissional certo, a negociação continua de forma simples pelo WhatsApp.</p>
        </article>
      </section>

      <section id="para-quem" className="home-market-section">
        <div className="home-section-heading">
          <p className="home-eyebrow">PARA QUEM É</p>
          <h2>Um só lugar para quem procura e para quem oferece.</h2>
        </div>

        <div className="home-market-grid">
          <article>
            <span>PARA ORGANIZADORES</span>
            <h3>Encontre as pessoas certas.</h3>
            <p>Descubra fornecedores para festas, eventos corporativos, ativações, passeios, oficinas e experiências.</p>
          </article>

          <article>
            <span>PARA FORNECEDORES</span>
            <h3>Mostre o que você faz.</h3>
            <p>Tenha uma presença profissional no LOSI CONECTA e seja encontrado por quem está procurando soluções.</p>
          </article>
        </div>
      </section>

      <section id="categorias" className="home-categories-section">
        <div className="home-section-heading home-section-heading-row">
          <div>
            <p className="home-eyebrow">CATEGORIAS</p>
            <h2>Serviços para diferentes momentos do evento.</h2>
          </div>
        </div>

        <div className="home-category-grid">
          {[
            "Recreação e entretenimento",
            "Monitoria",
            "Fotografia e vídeo",
            "DJ e música",
            "Decoração",
            "Buffet e alimentação",
            "Atrações",
            "Estruturas e equipamentos",
          ].map((category, index) => (
            <Link key={category} to="/buscar" className="home-category-card">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{category}</strong>
              <b>›</b>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-final-cta">
        <div>
          <p className="home-eyebrow home-eyebrow-light">LOSI CONECTA</p>
          <h2>Seu próximo evento começa com uma boa conexão.</h2>
        </div>
        <Link to="/entrar" className="home-final-button">Criar minha conta</Link>
      </section>

      <footer className="home-footer home-apple-footer">
        <div className="home-footer-top">
          <div className="home-footer-brand">
            <AppLogo className="home-footer-logo" aria-label="LOSI CONECTA" />
            <p>Uma plataforma para aproximar eventos, profissionais e oportunidades.</p>
          </div>

          <div className="home-footer-column">
            <strong>LOSI CONECTA</strong>
            <a href="#como-funciona">Como funciona</a>
            <a href="#para-quem">Para quem é</a>
            <a href="#categorias">Categorias</a>
          </div>

          <div className="home-footer-column">
            <strong>ACESSO</strong>
            <Link to="/buscar">Encontrar fornecedores</Link>
            <Link to="/faq">Perguntas frequentes</Link>
            <Link to="/entrar">Entrar</Link>
          </div>
        </div>

        <div className="home-footer-bottom">
          <span>Encontre. Conheça. Conecte.</span>
          <span>© {new Date().getFullYear()} LOSI CONECTA. Todos os direitos reservados.</span>
        </div>
      </footer>
    </main>
  );
}
