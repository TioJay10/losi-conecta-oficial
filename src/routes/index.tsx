import { Link, createFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { AppLogo } from "../components/AppLogo";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [customization, setCustomization] = useState({ hero_title: "", hero_subtitle: "", hero_button_text: "" });

  useEffect(() => {
    let mounted = true;
    const loadCustomization = async () => {
      const { data } = await supabase.from("home_customization_settings").select("key,value");
      if (!mounted) return;
      const values = Object.fromEntries((data ?? []).map(item => [item.key, item.value]));
      setCustomization({
        hero_title: values.hero_title ?? "",
        hero_subtitle: values.hero_subtitle ?? "",
        hero_button_text: values.hero_button_text ?? "",
      });
    };
    void loadCustomization();
    return () => { mounted = false; };
  }, []);

  return (
    <main className="home-page" style={styles.page}>
      <header className="home-header" style={styles.header}>
        <AppLogo className="mobile-centered-brand" style={styles.logo}>
          LOSI <span>CONECTA</span>
        </AppLogo>

        <nav className="home-nav" style={styles.nav}>
          <a href="#como-funciona" style={styles.navLink}>Como funciona</a>
          <a href="#para-quem" style={styles.navLink}>Para quem é</a>
          <a href="#categorias" style={styles.navLink}>Categorias</a>
        </nav>

        <Link to="/entrar" style={styles.headerButton}>Entrar</Link>
      </header>

      <section className="home-hero" style={styles.hero}>
        <div style={styles.heroGlow} />
        <div style={styles.eyebrow}>A REDE DE PROFISSIONAIS PARA EVENTOS</div>
        <h1 style={styles.heroTitle}>
          {customization.hero_title || "Encontre quem você precisa para realizar seu evento."}
        </h1>
        <p style={styles.heroText}>
          {customization.hero_subtitle || "O LOSI CONECTA aproxima quem organiza eventos de profissionais, empresas e fornecedores especializados — tudo em um só lugar."}
        </p>

        <div style={styles.heroActions}>
          <Link to="/buscar" style={styles.primaryButton}>{customization.hero_button_text || "Encontrar fornecedores"}</Link>
          <a href="#como-funciona" style={styles.secondaryButton}>Entender como funciona</a>
        </div>

        <div style={styles.heroNote}>
          <span style={styles.dot} /> Encontre • Conheça • Conecte
        </div>
      </section>

      <section id="como-funciona" className="home-section" style={styles.section}>
        <div style={styles.sectionIntro}>
          <div style={styles.sectionKicker}>COMO FUNCIONA</div>
          <h2 style={styles.sectionTitle}>Do que você precisa ao contato com o fornecedor.</h2>
          <p style={styles.sectionText}>
            O LOSI CONECTA foi pensado para deixar a busca por profissionais de eventos
            mais simples, organizada e objetiva.
          </p>
        </div>

        <div className="home-steps" style={styles.steps}>
          <Step number="01" title="Encontre" text="Pesquise por serviço, categoria e localização para descobrir profissionais que atendem ao que seu evento precisa." />
          <Step number="02" title="Conheça" text="Veja o perfil profissional, serviços oferecidos, descrição, portfólio, localização e informações de contato." />
          <Step number="03" title="Conecte" text="Quando encontrar o profissional ideal, entre em contato diretamente pelo WhatsApp e avance para a negociação." />
        </div>
      </section>

      <section id="para-quem" className="home-dark-section" style={styles.darkSection}>
        <div style={styles.darkIntro}>
          <div style={styles.sectionKickerLight}>PARA QUEM É</div>
          <h2 style={styles.darkTitle}>Um ponto de encontro para o mercado de eventos.</h2>
          <p style={styles.darkText}>
            Seja para organizar um evento ou para divulgar seus serviços,
            o LOSI CONECTA cria uma ponte entre quem procura e quem oferece.
          </p>
        </div>

        <div className="home-audience-grid" style={styles.audienceGrid}>
          <Audience
            title="Quem organiza"
            text="Encontre fornecedores e profissionais para festas, eventos corporativos, ativações, passeios e outras experiências."
            label="PROCURAR FORNECEDORES"
          />
          <Audience
            title="Quem fornece"
            text="Crie sua presença profissional, apresente seus serviços e seja encontrado por pessoas que estão procurando soluções para eventos."
            label="DIVULGAR SERVIÇOS"
          />
        </div>
      </section>

      <section id="categorias" className="home-section home-categories-section" style={styles.section}>
        <div style={styles.sectionIntro}>
          <div style={styles.sectionKicker}>O QUE VOCÊ PODE ENCONTRAR</div>
          <h2 style={styles.sectionTitle}>Profissionais de diferentes áreas do evento.</h2>
          <p style={styles.sectionText}>
            A plataforma pode reunir desde serviços essenciais até atrações e soluções
            especializadas para diferentes formatos de evento.
          </p>
        </div>

        <div className="home-category-grid" style={styles.categoryGrid}>
          {[
            "Recreação e entretenimento",
            "Fotografia e vídeo",
            "DJ e música",
            "Decoração",
            "Buffet e alimentação",
            "Atrações",
            "Estruturas e equipamentos",
            "Outros serviços para eventos",
          ].map((category) => (
            <div key={category} style={styles.categoryCard}>
              <span style={styles.categoryMark}>+</span>
              <span>{category}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-cta-section" style={styles.ctaSection}>
        <div className="home-cta-card" style={styles.ctaCard}>
          <div>
            <div style={styles.sectionKickerLight}>LOSI CONECTA</div>
            <h2 style={styles.ctaTitle}>Seu próximo evento começa com as conexões certas.</h2>
            <p style={styles.ctaText}>
              Crie sua conta e faça parte de uma plataforma criada para aproximar
              profissionais e oportunidades no mercado de eventos.
            </p>
          </div>
          <Link to="/entrar" style={styles.ctaButton}>Criar minha conta</Link>
        </div>
      </section>

      <footer style={styles.footer}>
        <div style={styles.footerBrand}>LOSI CONECTA</div>
        <div style={styles.footerText}>Encontre. Conheça. Conecte.</div>
      </footer>
    </main>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article style={styles.stepCard}>
      <div style={styles.stepNumber}>{number}</div>
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.cardText}>{text}</p>
    </article>
  );
}

function Audience({ title, text, label }: { title: string; text: string; label: string }) {
  return (
    <article style={styles.audienceCard}>
      <div style={styles.audienceLabel}>{label}</div>
      <h3 style={styles.audienceTitle}>{title}</h3>
      <p style={styles.audienceText}>{text}</p>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f5f8",
    color: "#172033",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    height: 68,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
    padding: "0 5vw",
    background: "rgba(255,255,255,.96)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid #e8eaf0",
  },
  logo: {
    textDecoration: "none",
    color: "#0b182a",
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: ".08em",
    whiteSpace: "nowrap",
  },
  logoSpan: {},
  nav: { display: "flex", gap: 28, alignItems: "center" },
  navLink: {
    color: "#697386",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
  },
  headerButton: {
    textDecoration: "none",
    color: "#fff",
    background: "#0b182a",
    borderRadius: 9,
    padding: "10px 17px",
    fontSize: 14,
    fontWeight: 800,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    textAlign: "center",
    padding: "78px 24px 68px",
    background: "linear-gradient(180deg, #ffffff 0%, #f4f5f8 100%)",
  },
  heroGlow: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(214,180,106,.13) 0%, rgba(214,180,106,0) 68%)",
    top: -260,
    left: "50%",
    transform: "translateX(-50%)",
    pointerEvents: "none",
  },
  eyebrow: {
    position: "relative",
    color: "#8a6d2f",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".18em",
    marginBottom: 22,
  },
  heroTitle: {
    position: "relative",
    maxWidth: 900,
    margin: "0 auto",
    fontSize: "clamp(42px, 7vw, 76px)",
    lineHeight: 1.02,
    letterSpacing: "-.055em",
    fontWeight: 900,
  },
  gradientText: {
    background: "linear-gradient(100deg, #d6b46a, #f0d99a)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },
  heroText: {
    maxWidth: 700,
    margin: "26px auto 0",
    color: "#697386",
    fontSize: 18,
    lineHeight: 1.65,
  },
  heroActions: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 34,
  },
  primaryButton: {
    textDecoration: "none",
    background: "#0b182a",
    color: "#fff",
    padding: "14px 23px",
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 15,
    boxShadow: "0 12px 30px rgba(79,70,199,.2)",
  },
  secondaryButton: {
    textDecoration: "none",
    background: "#fff",
    color: "#343b4d",
    padding: "14px 23px",
    borderRadius: 10,
    fontWeight: 750,
    fontSize: 15,
    border: "1px solid #dfe2ea",
  },
  heroNote: {
    marginTop: 28,
    color: "#7f8795",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: ".08em",
  },
  dot: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#d6b46a",
    marginRight: 8,
  },
  section: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "72px 5vw",
    boxSizing: "border-box",
  },
  sectionIntro: { maxWidth: 720, marginBottom: 38 },
  sectionKicker: {
    color: "#8a6d2f",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".16em",
    marginBottom: 14,
  },
  sectionKickerLight: {
    color: "#f0d99a",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".16em",
    marginBottom: 14,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "clamp(30px, 4vw, 48px)",
    lineHeight: 1.08,
    letterSpacing: "-.035em",
  },
  sectionText: {
    margin: "17px 0 0",
    color: "#70798b",
    fontSize: 17,
    lineHeight: 1.65,
  },
  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 18,
  },
  stepCard: {
    background: "#fff",
    border: "1px solid #e7e9ef",
    borderRadius: 18,
    padding: 24,
    minHeight: 190,
    boxSizing: "border-box",
    boxShadow: "0 10px 35px rgba(27,35,58,.04)",
  },
  stepNumber: {
    color: "#8a6d2f",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: ".1em",
    marginBottom: 40,
  },
  cardTitle: { margin: 0, fontSize: 25, letterSpacing: "-.02em" },
  cardText: { margin: "12px 0 0", color: "#70798b", lineHeight: 1.6, fontSize: 15 },
  darkSection: {
    background: "#0b182a",
    color: "#fff",
    padding: "72px 5vw",
  },
  darkIntro: { maxWidth: 1180, margin: "0 auto 38px" },
  darkTitle: {
    margin: 0,
    maxWidth: 700,
    fontSize: "clamp(32px, 5vw, 55px)",
    lineHeight: 1.05,
    letterSpacing: "-.04em",
  },
  darkText: { maxWidth: 650, color: "#c4cbd7", fontSize: 17, lineHeight: 1.65, marginTop: 18 },
  audienceGrid: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 18,
  },
  audienceCard: {
    border: "1px solid rgba(214,180,106,.25)",
    background: "#111f31",
    borderRadius: 18,
    padding: 30,
  },
  audienceLabel: { color: "#f0d99a", fontSize: 10, fontWeight: 900, letterSpacing: ".13em" },
  audienceTitle: { margin: "15px 0 0", fontSize: 29, letterSpacing: "-.025em" },
  audienceText: { color: "#c4cbd7", lineHeight: 1.65, fontSize: 15, margin: "12px 0 0", maxWidth: 500 },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  categoryCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    padding: "0 18px",
    background: "#fff",
    border: "1px solid #e5e8ef",
    borderRadius: 13,
    color: "#343b4d",
    fontWeight: 750,
    fontSize: 14,
  },
  categoryMark: { color: "#8a6d2f", fontSize: 20, fontWeight: 300 },
  ctaSection: { padding: "16px 5vw 64px" },
  ctaCard: {
    maxWidth: 1060,
    margin: "0 auto",
    borderRadius: 24,
    padding: "48px 52px",
    background: "linear-gradient(125deg, #0b182a, #07111f)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 35,
    boxSizing: "border-box",
    boxShadow: "0 20px 50px rgba(7,17,31,.16)",
  },
  ctaTitle: { margin: 0, maxWidth: 650, fontSize: "clamp(28px, 4vw, 43px)", lineHeight: 1.08, letterSpacing: "-.035em" },
  ctaText: { maxWidth: 620, color: "#c4cbd7", lineHeight: 1.6, margin: "14px 0 0", fontSize: 15 },
  ctaButton: {
    flexShrink: 0,
    textDecoration: "none",
    background: "#fff",
    color: "#0b182a",
    padding: "14px 20px",
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 14,
  },
  footer: {
    borderTop: "1px solid #e4e6ec",
    padding: "28px 6vw",
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    color: "#7f8795",
    fontSize: 12,
  },
  footerBrand: { fontWeight: 900, letterSpacing: ".12em", color: "#172033" },
  footerText: { fontWeight: 600 },
};

