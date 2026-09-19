import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.brand}>LOSI CONECTA</div>
        <div style={styles.eyebrow}>REDE PROFISSIONAL DE EVENTOS</div>
        <h1>Encontre os fornecedores certos para seu evento.</h1>
        <p>Pesquise profissionais, serviços e empresas para transformar seu evento em realidade.</p>
        <button onClick={() => navigate({ to: "/entrar" })} style={styles.button}>Entrar ou criar conta</button>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f8fc", color: "#172033", fontFamily: "Arial, sans-serif", padding: 24, boxSizing: "border-box" },
  hero: { width: "100%", maxWidth: 760, textAlign: "center" },
  brand: { fontSize: 14, fontWeight: 800, letterSpacing: ".18em", color: "#4f46c7", marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: "#7a8191", marginBottom: 18 },
  h1: { margin: 0, fontSize: 48, lineHeight: 1.08 },
  p: { margin: "20px auto", maxWidth: 600, color: "#687386", fontSize: 18, lineHeight: 1.5 },
  button: { marginTop: 10, border: 0, borderRadius: 10, background: "#4f46c7", color: "#fff", padding: "13px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
};
