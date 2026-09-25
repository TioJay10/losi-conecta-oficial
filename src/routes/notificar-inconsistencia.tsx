import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { InconsistencyUserChat } from "../components/InconsistencyChat";

export const Route = createFileRoute("/notificar-inconsistencia")({ component: InconsistencyPage });

function InconsistencyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) { navigate({ to: "/entrar" }); return; }
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) { navigate({ to: "/entrar" }); return; }
      setUser(data.user);
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [navigate]);

  if (loading || !user) {
    return <main className="inconsistency-page"><div className="inconsistency-loading">Verificando seu acesso...</div></main>;
  }

  return (
    <main className="inconsistency-page">
      <div className="inconsistency-page-top">
        <button type="button" onClick={() => navigate({ to: "/painel" })}>← Voltar ao painel</button>
      </div>
      <InconsistencyUserChat userId={user.id} />
    </main>
  );
}
