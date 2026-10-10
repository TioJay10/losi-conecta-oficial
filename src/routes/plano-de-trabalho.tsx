import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LiaPlanningChat } from "../components/LiaPlanningChat";
import { PanelMenuIcon } from "../components/PanelMenuIcon";
import { WorkPlanner } from "../components/WorkPlanner";
import type { PlannerCategory } from "../components/WorkPlanner";
import { supabase } from "../lib/supabase";
export const Route = createFileRoute("/plano-de-trabalho")({
  component: WorkPlannerPage,
});
function WorkPlannerPage() {
  const [mode, setMode] = useState<"chat" | "steps">("chat");
  const [openedSteps, setOpenedSteps] = useState(false);
  const [planContext, setPlanContext] = useState<string>();
  const consumed = useCallback(() => setPlanContext(undefined), []);
  const [userId, setUserId] = useState("");
  const [categories, setCategories] = useState<PlannerCategory[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      setCategories(data || []);
      setCategoryError("");
    } catch {
      setCategoryError(
        "Não foi possível carregar os nichos. Você pode continuar descrevendo os serviços.",
      );
    }
  }, []);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user.id || "");
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setUserId(session?.user.id || "");
      },
    );
    void loadCategories();
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadCategories]);
  if (!userId)
    return (
      <div className="wp-page" role="status">
        Preparando seu espaço de planejamento…
      </div>
    );
  return <div key={userId}>
    <div hidden={mode !== "chat"}><LiaPlanningChat userId={userId} onOpenSteps={() => { setOpenedSteps(true); setMode("steps"); }} planContext={planContext} onContextConsumed={consumed} /></div>
    {openedSteps && <div hidden={mode !== "steps"} className="lia-guided-page">
      <header className="lia-guided-bar"><button onClick={() => setMode("chat")}><PanelMenuIcon name="back"/>Voltar ao chat da Lia</button></header>
      <WorkPlanner userId={userId} onTalk={(brief) => { setPlanContext(brief); setMode("chat"); }} categories={categories} categoryError={categoryError} onRetryCategories={() => void loadCategories()} />
    </div>}
  </div>;
}
