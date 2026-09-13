import { useId } from "react";
import type { Challenge } from "../types";
import { Compass } from "lucide-react";
const emptyChallenge = (): Challenge => ({
  scenario: "",
  drivingQuestion: "",
  startingData: "",
  constraints: "",
  deliverable: "",
  dataTable: null,
});
export function ChallengeBrief({ challenge }: { challenge: Challenge }) {
  const table = challenge.dataTable;
  return (
    <section className="card challenge-brief" aria-label="Desafio da equipe">
      <span className="eyebrow">
        <Compass size={17} /> O DESAFIO DE VOCÊS
      </span>
      <h2>{challenge.drivingQuestion}</h2>
      <p className="challenge-text">{challenge.scenario}</p>
      <h3>O ponto de partida</h3>
      <p className="challenge-text">{challenge.startingData}</p>
      {table && (
        <p className="fine-print challenge-table-help">
          Deslize a tabela para ver todas as colunas.
        </p>
      )}
      {table && (
        <div
          className="challenge-table-scroll"
          role="region"
          aria-label={table.caption}
          tabIndex={0}
        >
          <table className="challenge-table">
            <caption>{table.caption}</caption>
            <thead>
              <tr>
                {table.columns.map((column, i) => (
                  <th scope="col" key={i}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th scope="row" key={j}>
                        {cell}
                      </th>
                    ) : (
                      <td key={j}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="challenge-rules">
        <h3>Regras e limites</h3>
        <p className="challenge-text">{challenge.constraints}</p>
      </div>
      <h3>O que a equipe vai entregar</h3>
      <p className="challenge-text">{challenge.deliverable}</p>
    </section>
  );
}
export function ChallengeEditor({
  challenge,
  onChange,
}: {
  challenge?: Challenge;
  onChange: (value: Challenge | undefined) => void;
}) {
  const fieldId = useId();
  if (!challenge)
    return (
      <section className="card stack">
        <h2>O problema que a equipe vai resolver</h2>
        <p>
          Apresente uma situação, dados de partida e uma entrega que dê sentido
          às perguntas.
        </p>
        <button
          className="button secondary"
          type="button"
          onClick={() => onChange(emptyChallenge())}
        >
          Adicionar enunciado do desafio
        </button>
      </section>
    );
  const edit = (patch: Partial<Challenge>) =>
    onChange({ ...challenge, ...patch });
  const table = challenge.dataTable;
  return (
    <section className="card stack challenge-editor">
      <h2>O problema que a equipe vai resolver</h2>
      <p className="muted">
        Este enunciado aparece antes das etapas. Confira se a equipe tem
        informações suficientes para começar e se as perguntas ajudam a resolver
        o desafio.
      </p>
      {(
        [
          ["scenario", "Situação do desafio", 3000, 4],
          ["drivingQuestion", "Pergunta central do desafio", 500, 2],
          ["startingData", "Dados e pistas de partida", 6000, 5],
          ["constraints", "Regras e limites do desafio", 2000, 3],
          ["deliverable", "Entrega esperada da equipe", 2000, 3],
        ] as const
      ).map(([field, label, maxLength, rows]) => (
        <div className="stack" key={field}>
          <label htmlFor={fieldId + field}>{label}</label>
          <textarea
            id={fieldId + field}
            required
            maxLength={maxLength}
            rows={rows}
            value={challenge[field]}
            onChange={(event) => edit({ [field]: event.target.value })}
          />
        </div>
      ))}
      <p className="fine-print">
        Diferencie dados fictícios de informações fornecidas. Em cálculos,
        explicite unidades, quantidades e condições. A entrega no aplicativo é
        textual; outros produtos podem ser apresentados à turma e sintetizados
        nas respostas.
      </p>
      {table ? (
        <fieldset className="stack">
          <legend>Tabela de apoio</legend>
          <label>
            Título e origem da tabela
            <input
              required
              maxLength={160}
              value={table.caption}
              onChange={(event) =>
                edit({ dataTable: { ...table, caption: event.target.value } })
              }
            />
          </label>
          <div className="form-grid">
            {table.columns.map((column, i) => (
              <div className="stack" key={i}>
                <label>
                  Coluna {i + 1}
                  <input
                    required
                    maxLength={100}
                    value={column}
                    onChange={(event) =>
                      edit({
                        dataTable: {
                          ...table,
                          columns: table.columns.map((c, j) =>
                            j === i ? event.target.value : c,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="button ghost"
                  disabled={table.columns.length <= 2}
                  onClick={() =>
                    edit({
                      dataTable: {
                        ...table,
                        columns: table.columns.filter((_, j) => j !== i),
                        rows: table.rows.map((row) =>
                          row.filter((_, j) => j !== i),
                        ),
                      },
                    })
                  }
                >
                  Remover coluna {i + 1}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button secondary"
            disabled={table.columns.length >= 6}
            onClick={() =>
              edit({
                dataTable: {
                  ...table,
                  columns: [...table.columns, ""],
                  rows: table.rows.map((row) => [...row, ""]),
                },
              })
            }
          >
            Adicionar coluna
          </button>
          {table.rows.map((row, i) => (
            <fieldset className="card soft stack" key={i}>
              <legend>Linha {i + 1}</legend>
              <div className="form-grid">
                {row.map((cell, j) => (
                  <label key={j}>
                    Linha {i + 1}, {table.columns[j] || "coluna " + (j + 1)}
                    <input
                      required
                      maxLength={300}
                      value={cell}
                      onChange={(event) =>
                        edit({
                          dataTable: {
                            ...table,
                            rows: table.rows.map((r, k) =>
                              k === i
                                ? r.map((c, l) =>
                                    l === j ? event.target.value : c,
                                  )
                                : r,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="button ghost"
                disabled={table.rows.length <= 1}
                onClick={() =>
                  edit({
                    dataTable: {
                      ...table,
                      rows: table.rows.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                Remover linha {i + 1}
              </button>
            </fieldset>
          ))}
          <div className="row wrap">
            <button
              type="button"
              className="button secondary"
              disabled={table.rows.length >= 12}
              onClick={() =>
                edit({
                  dataTable: {
                    ...table,
                    rows: [...table.rows, table.columns.map(() => "")],
                  },
                })
              }
            >
              Adicionar linha
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                if (window.confirm("Remover a tabela deste rascunho?"))
                  edit({ dataTable: null });
              }}
            >
              Remover tabela de apoio
            </button>
          </div>
        </fieldset>
      ) : (
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            edit({
              dataTable: {
                caption: "Dados fictícios para a atividade",
                columns: ["Item", "Informação"],
                rows: [["", ""]],
              },
            })
          }
        >
          Adicionar tabela de apoio
        </button>
      )}
      <details>
        <summary>Ver como o desafio aparece para a equipe</summary>
        <ChallengeBrief challenge={challenge} />
      </details>
      <button
        type="button"
        className="button ghost"
        onClick={() => {
          if (
            window.confirm(
              "Remover o enunciado deste rascunho? As etapas e questões serão mantidas.",
            )
          )
            onChange(undefined);
        }}
      >
        Remover enunciado do desafio
      </button>
    </section>
  );
}
