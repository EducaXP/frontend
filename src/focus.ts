import type { FocusDraft, Workspace } from "./types";
export const focusRemaining = (draft: FocusDraft, now = Date.now()) =>
  draft.endsAt
    ? Math.max(0, Math.ceil((draft.endsAt - now) / 1000))
    : draft.remaining;
export const hasFocusWork = (data: Pick<Workspace, "focus">) =>
  Object.values(data.focus || {}).filter((f) => f.status !== "synced").length;
export const emptyFocus = (): FocusDraft => ({
  goal: "",
  strategy: "Alternar os papéis e conversar sobre cada descoberta",
  reflection: "",
  remaining: 1500,
  status: "local",
});
