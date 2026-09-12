import type { Content } from "./types";

// A local writing aid based on the teacher's assessment, not an automatic evaluation.
export function suggestFeedback(
  content: Content,
  scores: Record<string, number>,
): string {
  if (
    content.rubric.some(
      (c) =>
        !Number.isInteger(scores[c.id]) ||
        scores[c.id]! < 0 ||
        scores[c.id]! > 3,
    )
  )
    throw new Error("Revise todos os critérios antes de sugerir o feedback.");
  const observations = content.rubric.map(
    (c) =>
      `${c.title.slice(0, 100)}: ${c.levels[scores[c.id]!]!.slice(0, 220)}`,
  );
  const next =
    content.rubric.find((c) => scores[c.id]! < 2) ||
    content.rubric.find((c) => scores[c.id]! < 3);
  const action = next
    ? `Na próxima rodada, concentrem-se em ${next.title.slice(0, 100)}. O próximo objetivo é: ${next.levels[scores[next.id]! + 1]!.slice(0, 220)}`
    : "Para ir além, testem a conclusão em uma situação diferente e expliquem se as evidências ainda a sustentam.";
  return [
    "Equipe, aqui vai uma devolutiva para orientar a próxima descoberta!",
    ...observations,
    action,
    content.questions?.length
      ? "Revisem cada resposta à luz dessa devolutiva: que explicação ou evidência vocês podem acrescentar?"
      : "Que evidência ou explicação vocês podem acrescentar à produção?",
  ]
    .join("\n\n")
    .slice(0, 4000);
}
