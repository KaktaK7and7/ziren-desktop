export const ONBOARDING_OPEN_EVENT = "ziren-onboarding-open";


export function requestOnboardingOpen() {
  window.dispatchEvent(new CustomEvent(ONBOARDING_OPEN_EVENT));
}
