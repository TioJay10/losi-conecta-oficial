export type PlanKind = "work" | "business";
export type PlanContext = { briefing: string; kind: PlanKind; draftId: string; title: string; content?: string };
export type GeneratedPlan = {
  requestId: string;
  conversationId: string;
  messageId: string;
  draftId?: string;
  title: string;
  kind: PlanKind;
  content: string;
  description: string;
};
export type AppliedPlan = { conversationId: string; draftId: string; kind: PlanKind; title: string; briefing: string; content: string };
