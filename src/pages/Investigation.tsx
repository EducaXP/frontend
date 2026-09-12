import type { Answer, Question } from "../types";

export function QuestionEditor({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (questions: Question[] | undefined) => void;
}) {
  return (
    <section className="card stack">
      <h2>Pontos-chave da investigação</h2>
      <p className="muted">
        Defina uma pergunta por ponto-chave. A equipe precisará entregar uma
        resposta a cada questão, inclusive quando o registro for mediado.
      </p>
      {questions.map((question, i) => (
        <div className="card soft" key={question.id}>
          <label>
            Tópico da questão {i + 1}
            <input
              required
              maxLength={160}
              value={question.topic}
              onChange={(e) =>
                onChange(
                  questions.map((q) =>
                    q.id === question.id ? { ...q, topic: e.target.value } : q,
                  ),
                )
              }
            />
          </label>
          <label>
            Pergunta {i + 1}
            <textarea
              required
              maxLength={1500}
              rows={3}
              value={question.prompt}
              onChange={(e) =>
                onChange(
                  questions.map((q) =>
                    q.id === question.id ? { ...q, prompt: e.target.value } : q,
                  ),
                )
              }
              placeholder="Qual pista sustenta a conclusão da equipe? Expliquem com um exemplo."
            />
          </label>
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              const next = questions.filter((q) => q.id !== question.id);
              onChange(next.length ? next : undefined);
            }}
          >
            Remover questão {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        disabled={questions.length >= 10}
        onClick={() =>
          onChange([
            ...questions,
            { id: crypto.randomUUID(), topic: "", prompt: "" },
          ])
        }
      >
        Adicionar questão
      </button>
    </section>
  );
}

export function QuestionAnswers({
  questions,
  answers = [],
  onChange,
}: {
  questions: Question[];
  answers?: Answer[];
  onChange?: (answers: Answer[]) => void;
}) {
  return (
    <div className="stack">
      {questions.map((q, i) => (
        <div key={q.id} className="card soft">
          <strong>
            PISTA {i + 1} · {q.topic}
          </strong>
          <p>{q.prompt}</p>
          {onChange ? (
            <label>
              Resposta à questão {i + 1}
              <textarea
                required
                maxLength={2000}
                rows={4}
                value={answers.find((a) => a.questionId === q.id)?.text || ""}
                placeholder="Registrem a descoberta e expliquem as evidências…"
                onChange={(e) =>
                  onChange([
                    ...answers.filter((a) => a.questionId !== q.id),
                    { questionId: q.id, text: e.target.value },
                  ])
                }
              />
            </label>
          ) : (
            <p className="evidence-text">
              {answers.find((a) => a.questionId === q.id)?.text ||
                "Sem resposta registrada."}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
