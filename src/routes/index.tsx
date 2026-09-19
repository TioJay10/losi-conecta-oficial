import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f7f8fc",
        color: "#172033",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section style={{ textAlign: "center", padding: 32 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "#5b4bdb",
            marginBottom: 16,
          }}
        >
          LOSI CONECTA
        </div>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.1 }}>
          Encontre os fornecedores certos para seu evento.
        </h1>
        <p style={{ marginTop: 16, fontSize: 18, color: "#647084" }}>
          Base oficial do novo aplicativo.
        </p>
        <div
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "10px 16px",
            borderRadius: 999,
            background: "#e8e5ff",
            color: "#4b3fc2",
            fontWeight: 700,
          }}
        >
          SISTEMA ONLINE
        </div>
      </section>
    </main>
  );
}