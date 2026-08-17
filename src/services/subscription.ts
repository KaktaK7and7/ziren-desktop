import {
  fetchAuthenticatedAuthApi,
  getAuthSiteOrigin,
  readAuthApiJson,
} from "./auth";


export type SubscriptionStatus = {
  plan: "free" | "plus" | "pro";
  plan_name: string;
  status: string;
  ai_enabled: boolean;
  beta_override: boolean;
  ai_usage_percent: number;
  ai_remaining_percent: number;
  ai_requests: number;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end: boolean;
  entitlements: string[];
};

type SubscriptionResponse = {
  ok: boolean;
  subscription?: SubscriptionStatus;
  error?: string;
};


export async function fetchSubscriptionStatus() {
  const response = await fetchAuthenticatedAuthApi("/api/subscriptions/me", {
    method: "GET",
    cache: "no-store",
  });
  const data = await readAuthApiJson<SubscriptionResponse>(
    response,
    "Не удалось загрузить тариф",
  );

  if (!response.ok || !data.ok || !data.subscription) {
    throw new Error(data.error || "Не удалось загрузить тариф");
  }

  return data.subscription;
}


export function getPricingUrl() {
  return `${getAuthSiteOrigin()}/pricing.html`;
}
