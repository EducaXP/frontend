import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { useApp } from "../context";
import { api } from "../api";
import type { Content, PlanningAssistant } from "../types";
import { Badge, ErrorText } from "../ui";

const empty: PlanningAssistant = { prompt: "", resources: "", history: [] };
export default function PlanningAssistantPanel({
  onBusyChange,
  disabled,
}: {
  onBusyChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const { data, update, token, online, notice } = useApp();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const planning = data.planning!;
  const assistant = planning.assistant || empty;
  useEffect(
    () => () => {
      generation.current++;
      onBusyChange(false);
    },
    [onBusyChange],
  );
  useEffect(() => {
    let cancelled = false;
    setEnabled(null);
    if (online && token)
      void api<{ enabled: boolean }>("/planning/assistant/status", token)
        .then((result) => {
          if (!cancelled) setEnabled(result.enabled);
        })
        .catch(() => {
          if (!cancelled) setEnabled(false);
        });
    return () => {
      cancelled = true;
    };
  }, [online, token]);
  function edit(patch: Partial<PlanningAssistant>) {
    void update((current) =>
      current.planning
        ? {
            ...current,
            planning: {
              ...current.planning,
              assistant: { ...(current.planning.assistant || empty), ...patch },
            },
          }
        : current,
    ).catch(() =>
      setError("Não foi possível guardar o pedido neste aparelho."),
    );
  }
  async function send() {
    if (!assistant.prompt.trim() || busy || !online || !enabled || disabled)
      return;
    const topics = (assistant.topics || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (topics.length > 10 || topics.some((t) => t.length > 160)) {
      setError(
        "Use até dez tópicos, um por linha, com até 160 caracteres cada.",
      );
      return;
    }
    const requestId = ++generation.current;
    const owner = data.user.id;
    const baseContent = JSON.stringify(planning.content);
    const instruction = assistant.prompt.trim();
    const { bnccReference: _reference, ...currentDraft } =
      assistant.proposal?.content || planning.content;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const result = await api<{ reply: string; content: Content }>(
        "/planning/assistant",
        token,
        "POST",
        {
          classroomId: planning.classroomId,
          instruction,
          subject: planning.content.subject,
          schoolYear: planning.content.schoolYear,
          durationMinutes: planning.content.durationMinutes,
          resources: assistant.resources,
          topics,
          currentDraft,
          history: assistant.history.slice(-8),
        },
        60000,
      );
      if (generation.current !== requestId) return;
      await update((current) => {
        if (
          current.user.id !== owner ||
          !current.planning ||
          current.planning.classroomId !== planning.classroomId ||
          current.planning.missionId !== planning.missionId
        )
          return current;
        return {
          ...current,
          planning: {
            ...current.planning,
            assistant: {
              ...(current.planning.assistant || empty),
              prompt: "",
              history: [
                ...assistant.history,
                { role: "user" as const, content: instruction.slice(0, 3000) },
                { role: "assistant" as const, content: result.reply },
              ].slice(-8),
              proposal: { ...result, baseContent },
            },
          },
        };
      });
    } catch (e) {
      if (generation.current === requestId)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível preparar uma proposta.",
        );
    } finally {
      if (generation.current === requestId) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  async function apply() {
    const proposal = assistant.proposal;
    if (!proposal || disabled || busy) return;
    if (
      JSON.stringify(planning.content) !== proposal.baseContent &&
      !window.confirm(
        "Você editou o rascunho depois do pedido. Aplicar a proposta substituirá esses textos. Deseja continuar?",
      )
    )
      return;
    try {
      await update((current) => {
        if (!current.planning) return current;
        return {
          ...current,
          planning: {
            ...current.planning,
            content: {
              ...proposal.content,
              ...(current.planning.content.bnccReference
                ? { bnccReference: current.planning.content.bnccReference }
                : {}),
            },
            assistant: {
              ...(current.planning.assistant || empty),
              proposal: undefined,
            },
          },
        };
      });
      notice(
        "Proposta aplicada ao rascunho. Revise os campos abaixo antes de publicar.",
      );
    } catch {
      setError(
        "Não foi possível guardar a proposta. Mantenha esta página aberta.",
      );
    }
  }
  return (
    <section
      className="card assistant-panel"
      aria-label="Assistente de planejamento"
    >
      <div className="row between wrap">
        <div className="row">
          <span className="round-icon violet">
            <Sparkles size={22} />
          </span>
          <div>
            <h2>Planeje com seu assistente</h2>
            <p className="muted">
              Descreva sua ideia. Peça ajustes. Construa a atividade com a IA.
            </p>
          </div>
        </div>
        <Badge tone={enabled && online ? "success" : "warning"}>
          {online
            ? enabled === null
              ? "Consultando disponibilidade"
              : enabled
                ? "Assistente disponível"
                : "Aguardando ativação"
            : "Sem conexão"}
        </Badge>
      </div>
      {!online ? (
        <p className="alert">
          A conversa com a IA precisa de conexão. Seu pedido e o editor
          continuam disponíveis neste aparelho.
        </p>
      ) : (
        enabled === false && (
          <p className="alert">
            O assistente aguarda ativação pela administração. Você já pode
            preparar seu pedido e usar o modelo editável abaixo.
          </p>
        )
      )}
      <p className="fine-print">
        Ao enviar, o provedor de IA recebe seu pedido, os recursos, o rascunho e
        até oito mensagens da conversa. A proposta considera o componente, ano e
        duração definidos no editor abaixo. Descreva recursos e necessidades sem
        nomes ou dados pessoais dos estudantes.
      </p>
      <label>
        Tópicos da investigação (um por linha)
        <textarea
          rows={3}
          maxLength={1600}
          value={assistant.topics || ""}
          disabled={busy}
          onChange={(e) => edit({ topics: e.target.value })}
          placeholder={
            "Porcentagem\nDescontos sucessivos\nComparação de preços"
          }
        />
      </label>
      <label>
        Recursos disponíveis
        <textarea
          rows={2}
          maxLength={1500}
          placeholder="Ex.: um celular por equipe, papel, lápis e régua."
          value={assistant.resources}
          disabled={busy}
          onChange={(e) => edit({ resources: e.target.value })}
        />
      </label>
      {assistant.history.length > 0 && (
        <div
          className="assistant-conversation"
          role="log"
          aria-label="Conversa de planejamento"
        >
          {assistant.history.map((message, i) => (
            <article className={`assistant-message ${message.role}`} key={i}>
              <strong>{message.role === "user" ? "Você" : "Assistente"}</strong>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label>
          Pedido para o assistente
          <textarea
            rows={3}
            maxLength={4000}
            required
            disabled={busy}
            placeholder="Crie uma missão sobre porcentagem usando preços de mercado, com investigação em equipes e uma rubrica simples."
            value={assistant.prompt}
            onChange={(e) => edit({ prompt: e.target.value })}
          />
        </label>
        <div className="row between wrap">
          <small className="muted">
            Você revisa a proposta antes de aplicá-la e publicá-la.
          </small>
          <button
            className="button primary"
            disabled={
              disabled ||
              !online ||
              !enabled ||
              busy ||
              !assistant.prompt.trim()
            }
          >
            <Send size={17} />
            {busy
              ? "Preparando proposta…"
              : assistant.history.length
                ? "Pedir ajuste"
                : "Criar com IA"}
          </button>
        </div>
      </form>
      {busy && (
        <p role="status">
          O assistente está preparando a atividade. Seu rascunho atual permanece
          salvo.
        </p>
      )}
      {assistant.history.length > 0 && (
        <button
          className="button ghost"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Limpar a conversa e a proposta pendente? O rascunho no editor será mantido.",
              )
            )
              edit({ history: [], proposal: undefined });
          }}
        >
          Limpar conversa
        </button>
      )}
      <ErrorText error={error} />
      {assistant.proposal && (
        <article
          className="assistant-proposal"
          aria-label="Proposta para revisão"
        >
          <Badge tone="violet">
            <MessageSquare size={14} /> PROPOSTA DA IA · REVISÃO DOCENTE
          </Badge>
          <h3>{assistant.proposal.content.title}</h3>
          <p>{assistant.proposal.content.objective}</p>
          <p className="muted">
            {assistant.proposal.content.subject} ·{" "}
            {assistant.proposal.content.schoolYear} ·{" "}
            {assistant.proposal.content.durationMinutes} min
          </p>
          <ol>
            {assistant.proposal.content.steps.map((step, i) => (
              <li key={i}>
                <strong>{step.title}</strong>
                <p>{step.instructions}</p>
                <small>
                  {step.mode === "off_screen"
                    ? "Fora da tela"
                    : "Registro digital ou mediado"}
                </small>
              </li>
            ))}
          </ol>
          <h3>Questões que a equipe deverá responder</h3>
          <ol>
            {assistant.proposal.content.questions?.map((q) => (
              <li key={q.id}>
                <strong>{q.topic}</strong>
                <p>{q.prompt}</p>
              </li>
            ))}
          </ol>
          <h3>Alternativa sem aparelho</h3>
          <p>{assistant.proposal.content.offlineAlternative}</p>
          <h3>Rubrica sugerida</h3>
          {assistant.proposal.content.rubric.map((criterion) => (
            <details key={criterion.id}>
              <summary>{criterion.title}</summary>
              <ol>
                {criterion.levels.map((level, i) => (
                  <li key={i}>{level}</li>
                ))}
              </ol>
            </details>
          ))}
          <p className="fine-print">
            Alinhamento à BNCC pendente de verificação.
          </p>
          <div className="row wrap">
            <button
              className="button secondary"
              disabled={disabled || busy}
              onClick={() => void apply()}
            >
              Aplicar proposta ao rascunho
            </button>
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => edit({ proposal: undefined })}
            >
              Descartar proposta
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
