import { expect, it } from "vitest";
import { emptyFocus, focusRemaining, hasFocusWork } from "../../src/focus";
import type { Workspace } from "../../src/types";
it("cronômetro retoma pelo prazo salvo, permite pausa e nunca registra XP pelo tempo", () => {
  const draft = { ...emptyFocus(), endsAt: 100000 };
  expect(focusRemaining(draft, 90000)).toBe(10);
  expect(focusRemaining(draft, 110000)).toBe(0);
  const paused = { ...draft, endsAt: undefined, remaining: 10 };
  expect(focusRemaining(paused, 500000)).toBe(10);
  expect(draft.status).toBe("local");
});
it("troca de perfil considera registros de foco ainda não sincronizados", () => {
  const data = {
    focus: {
      a: emptyFocus(),
      b: { ...emptyFocus(), status: "synced" },
      c: { ...emptyFocus(), status: "error" },
    },
  } as Pick<Workspace, "focus">;
  expect(hasFocusWork(data)).toBe(2);
});
