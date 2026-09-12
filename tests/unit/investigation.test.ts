import { expect, it } from "vitest";
import {
  applyReceipt,
  emptyDraft,
  fromSubmission,
  hasWork,
  queueDraft,
} from "../../src/sync";
import { suggestFeedback } from "../../src/feedback";
import type { Content, Submission } from "../../src/types";

it("preserva respostas locais quando um recibo atrasado confirma a versão anterior", () => {
  const draft = {
    ...emptyDraft("m", "g"),
    answers: [{ questionId: "q", text: "Primeira hipótese" }],
  };
  expect(hasWork(draft)).toBe(true);
  const queued = queueDraft(draft, "digital");
  const sent: Submission = {
    ...queued.pending!,
    id: queued.submissionId,
    version: 1,
    receivedAfterClosure: false,
  };
  const edited = {
    ...queued,
    answers: [{ questionId: "q", text: "Hipótese revisada" }],
  };
  const received = applyReceipt(edited, queued.pending!.operationId, sent);
  expect(received.status).toBe("local");
  expect(received.answers?.[0]?.text).toBe("Hipótese revisada");
  expect(fromSubmission(sent).answers?.[0]?.text).toBe("Primeira hipótese");
  expect(queueDraft(edited, "digital").pending).toEqual(queued.pending);
});

it("feedback usa somente os níveis avaliados pelo professor e propõe um próximo passo", () => {
  const content = {
    rubric: [
      {
        id: "evidence",
        title: "Uso de evidências",
        levels: [
          "Precisa identificar evidências.",
          "Explica com apoio.",
          "Relaciona evidências à conclusão.",
          "Compara limites.",
        ],
      },
    ],
    questions: [{ id: "q", topic: "Descontos", prompt: "Qual o preço?" }],
  } as Content;
  expect(() => suggestFeedback(content, {})).toThrow();
  const text = suggestFeedback(content, { evidence: 1 });
  expect(text).toContain("Explica com apoio.");
  expect(text).toContain("Relaciona evidências à conclusão.");
  expect(text).toContain("Revisem cada resposta");
  expect(text).not.toContain("nota");
  expect(text.length).toBeLessThanOrEqual(4000);
});
