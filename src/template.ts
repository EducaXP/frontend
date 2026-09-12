import type { Content } from "./types";
export function template(theme = "uma questão da nossa escola"): Content {
  return {
    title: `Investigação: ${theme}`,
    objective: `Investigar ${theme}, comparar explicações e construir uma conclusão em equipe.`,
    subject: "Matemática",
    schoolYear: "9º ano",
    durationMinutes: 30,
    offlineAlternative:
      "Registrem a produção em papel ou apresentem oralmente. O professor pode registrar a síntese da equipe.",
    steps: [
      {
        title: "Uma pergunta, muitos olhares",
        instructions:
          "Conversem sobre a questão, combinem os papéis e registrem uma hipótese.",
        mode: "off_screen",
      },
      {
        title: "Hora de investigar",
        instructions:
          "Usem o material fornecido pelo professor. Coletem evidências e comparem as ideias.",
        mode: "off_screen",
      },
      {
        title: "Nossa descoberta",
        instructions:
          "Preparem uma síntese da conclusão e expliquem como chegaram até ela. A entrega pode ser no aparelho ou mediada pelo professor.",
        mode: "screen",
      },
    ],
    rubric: [
      {
        id: "evidence",
        title: "Construção da explicação",
        levels: [
          "Precisa de apoio para identificar evidências.",
          "Identifica evidências, mas precisa relacioná-las à conclusão.",
          "Relaciona evidências relevantes à conclusão.",
          "Compara evidências e reconhece os limites da conclusão.",
        ],
      },
      {
        id: "collaboration",
        title: "Colaboração",
        levels: [
          "Precisa de apoio para combinar a participação.",
          "Participa com apoio e escuta outras ideias.",
          "Contribui e incorpora ideias dos colegas.",
          "Ajuda a distribuir a participação e a resolver divergências com argumentos.",
        ],
      },
    ],
  };
}
