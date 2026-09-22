export type PlanSlug = "gratis" | "profissional" | "destaque";

export type ReputationSummary = {
  planSlug: PlanSlug;
  planName: string;
  planPriority: number;
  baseStars: number;
  stars: number;
  positiveReviews: number;
  totalReviews: number;
  satisfaction: number | null;
  level: 0 | 1 | 2 | 3;
  label: "Sem reputação" | "Atenção" | "Satisfação intermediária" | "Boa satisfação";
  rankingScore: number;
};

export function normalizePlanSlug(slug: string | null | undefined): PlanSlug {
  if (slug === "destaque") return "destaque";
  if (slug === "profissional") return "profissional";
  return "gratis";
}

export function getPlanDefaults(slug: PlanSlug) {
  if (slug === "destaque") {
    return { name: "Destaque", priority: 45, baseStars: 4, baselineSatisfaction: 90 };
  }
  if (slug === "profissional") {
    return { name: "Profissional", priority: 25, baseStars: 2, baselineSatisfaction: 70 };
  }
  return { name: "Grátis", priority: 0, baseStars: 0, baselineSatisfaction: null };
}

export function calculateReputation(
  planSlug: string | null | undefined,
  ratings: number[],
): ReputationSummary {
  const normalizedPlan = normalizePlanSlug(planSlug);
  const defaults = getPlanDefaults(normalizedPlan);
  const positiveReviews = ratings.filter((rating) => rating >= 4).length;
  const totalReviews = ratings.length;

  // O plano fornece a reputação inicial definida comercialmente.
  // Depois que existem avaliações reais, a satisfação passa a refletir o histórico.
  const satisfaction = totalReviews > 0
    ? Math.round((positiveReviews / totalReviews) * 100)
    : defaults.baselineSatisfaction;

  const stars = Math.min(6, defaults.baseStars + Math.floor(positiveReviews / 2));

  let level: 0 | 1 | 2 | 3 = 0;
  let label: ReputationSummary["label"] = "Sem reputação";

  if (totalReviews === 0) {
    if (normalizedPlan === "destaque") {
      level = 3;
      label = "Boa satisfação";
    } else if (normalizedPlan === "profissional") {
      level = 2;
      label = "Satisfação intermediária";
    }
  } else if ((satisfaction ?? 0) >= 80) {
    level = 3;
    label = "Boa satisfação";
  } else if ((satisfaction ?? 0) >= 60) {
    level = 2;
    label = "Satisfação intermediária";
  } else {
    level = 1;
    label = "Atenção";
  }

  // Reputação pesa mais que a vantagem comercial do plano.
  // Assim, um gratuito com histórico excelente pode superar um pago com histórico ruim.
  const reputationWeight = totalReviews > 0 ? (satisfaction ?? 0) * 0.75 : 0;
  const starWeight = stars * 2.5;
  const rankingScore = Math.round(defaults.priority + reputationWeight + starWeight);

  return {
    planSlug: normalizedPlan,
    planName: defaults.name,
    planPriority: defaults.priority,
    baseStars: defaults.baseStars,
    stars,
    positiveReviews,
    totalReviews,
    satisfaction,
    level,
    label,
    rankingScore,
  };
}
