import { useCallback, useState } from "react";
import { LiaPlanningChat, type LiaRequest } from "./LiaPlanningChat";
import { PanelMenuIcon } from "./PanelMenuIcon";
import { WorkPlanner, type PlannerCategory } from "./WorkPlanner";
import type { AppliedPlan, GeneratedPlan, PlanContext } from "../lib/planning-link";
export function PlanningWorkspace({userId,categories,categoryError,onRetryCategories,request}:{userId:string;categories:PlannerCategory[];categoryError?:string;onRetryCategories:()=>void;request?:LiaRequest}) {
  const [mode,setMode]=useState<"chat"|"steps">("chat");
  const [openedSteps,setOpenedSteps]=useState(false);
  const [planContext,setPlanContext]=useState<PlanContext>();
  const [incomingPlan,setIncomingPlan]=useState<GeneratedPlan>();
  const [appliedPlan,setAppliedPlan]=useState<AppliedPlan>();
  const consumed=useCallback(()=>setPlanContext(undefined),[]);
  const applied=useCallback((plan:AppliedPlan)=>{setAppliedPlan(plan);setIncomingPlan(undefined);},[]);
  return <div>
    <div hidden={mode!=="chat"}><LiaPlanningChat userId={userId} request={request} onOpenSteps={()=>{setOpenedSteps(true);setMode("steps");}} planContext={planContext} onContextConsumed={consumed} onApplyPlan={plan=>{setIncomingPlan(plan);setOpenedSteps(true);setMode("steps");}} appliedPlan={appliedPlan}/></div>
    {openedSteps&&<div hidden={mode!=="steps"} className="lia-guided-page"><header className="lia-guided-bar"><button onClick={()=>setMode("chat")}><PanelMenuIcon name="back"/>Voltar ao chat da Lia</button></header><WorkPlanner userId={userId} categories={categories} categoryError={categoryError} onRetryCategories={onRetryCategories} incomingPlan={incomingPlan} onPlanApplied={applied} onTalk={context=>{setPlanContext(context);setMode("chat");}}/></div>}
  </div>;
}
