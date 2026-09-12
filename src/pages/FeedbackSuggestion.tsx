import { useState } from "react";
import type { Content } from "../types";
import { suggestFeedback } from "../feedback";
export default function FeedbackSuggestion({
  content,
  scores,
  onApply,
}: {
  content: Content;
  scores: Record<string, number>;
  onApply: (text: string) => void;
}) {
  const [proposal, setProposal] = useState("");
  const ready = content.rubric.every(
    (c) =>
      Number.isInteger(scores[c.id]) &&
      scores[c.id]! >= 0 &&
      scores[c.id]! <= 3,
  );
  return (
    <section className="card soft">
      <h3>Uma ajuda para escrever a devolutiva</h3>
      <p className="fine-print">
        Sugestão local baseada nos níveis que você marcou. Não analisa
        automaticamente as respostas nem envia produções a um provedor de IA.
        Revise e acrescente exemplos da entrega.
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={!ready}
        onClick={() => setProposal(suggestFeedback(content, scores))}
      >
        Sugerir feedback
      </button>
      {!ready && (
        <p className="fine-print">
          Marque todos os critérios da rubrica para preparar a sugestão.
        </p>
      )}
      {proposal && (
        <>
          <p className="evidence-text" aria-label="Sugestão de feedback">
            {proposal}
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={() => onApply(proposal)}
          >
            Usar sugestão na devolutiva
          </button>
        </>
      )}
    </section>
  );
}
