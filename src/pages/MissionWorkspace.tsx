import { ChallengeBrief } from "./Challenge";
import FocusPanel from "./FocusPanel";
import { QuestionAnswers } from "./Investigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  MessageSquare,
  Monitor,
  PencilLine,
  Users,
} from "lucide-react";
import { useApp } from "../context";
import { api, list } from "../api";
import { emptyDraft, fromSubmission, queueDraft } from "../sync";
import {
  draftKey,
  type Draft,
  type Group,
  type Mission,
  type Submission,
} from "../types";
import { Badge, ErrorText, PageTitle } from "../ui";

export default function MissionWorkspace({
  mission,
  group,
}: {
  mission: Mission;
  group: Group;
}) {
  const {
    data,
    update,
    token,
    online,
    sync,
    saving,
    storageError,
    persistent,
    notice,
    navigate,
  } = useApp();
  const key = draftKey(mission.id, group.id),
    draft = data.drafts[key];
  const [remote, setRemote] = useState<Submission | null>(null),
    [loading, setLoading] = useState(true),
    [submitting, setSubmitting] = useState(false),
    [error, setError] = useState("");
  const teacher = data.user.role === "teacher";
  const questions = mission.content.questions || [];
  const complete =
    !!draft &&
    (questions.length
      ? questions.every((q) =>
          draft.answers?.some((a) => a.questionId === q.id && a.text.trim()),
        )
      : !!draft.evidence.trim());
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let existing: Submission | undefined;
        if (online && token) {
          existing = (
            await list<Submission>(`/missions/${mission.id}/submissions`, token)
          ).find((s) => s.groupId === group.id);
          if (existing)
            existing = await api<Submission>(
              `/submissions/${existing.id}`,
              token,
            );
        }
        if (cancelled) return;
        setRemote(existing || null);
        await update((current) => {
          const local = current.drafts[key];
          if (local && local.status !== "synced") return current;
          return {
            ...current,
            drafts: {
              ...current.drafts,
              [key]: existing
                ? fromSubmission(existing)
                : local || emptyDraft(mission.id, group.id),
            },
          };
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível buscar a entrega anterior.",
          );
          // A local draft remains usable. Do not create a new draft on an uncertain network read.
          if (draft)
            setError(
              "A versão local está disponível. A versão do servidor não pôde ser consultada.",
            );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mission.id, group.id, token, online, update, data.updatedAt]);
  function edit(patch: Partial<Draft>) {
    void update((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        [key]: {
          ...current.drafts[key]!,
          ...patch,
          status: current.drafts[key]!.pending
            ? current.drafts[key]!.status
            : "local",
        },
      },
    })).catch(() => {});
  }
  async function submit() {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await update((current) => ({
        ...current,
        drafts: {
          ...current.drafts,
          [key]: queueDraft(
            current.drafts[key]!,
            teacher ? "teacher_mediated" : "digital",
          ),
        },
      }));
      await sync();
      if (!online)
        notice(
          "Entrega guardada na fila. O envio será automático quando a conexão voltar.",
        );
    } catch {
      setError(
        "Não foi possível salvar a entrega. Mantenha esta tela aberta e copie seu texto antes de sair.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  const statuses = {
    local: "Salvo neste aparelho",
    queued: "Aguardando envio",
    synced: "Sincronizado",
    conflict: "Revisão de versões necessária",
    error: "Envio precisa de atenção",
  };
  return (
    <>
      <button
        className="back-link"
        onClick={() => navigate(teacher ? "/missions" : "/")}
      >
        <ArrowLeft size={16} /> Voltar às missões
      </button>
      <PageTitle
        label={
          teacher ? "REGISTRO MEDIADO PELO PROFESSOR" : "SUA MISSÃO EM EQUIPE"
        }
        title={mission.content.title}
      />
      <div className="detail-layout">
        <section className="stack">
          <article className="card mission-intro">
            <div className="row wrap">
              <Badge>{mission.content.subject}</Badge>
              <Badge tone="violet">
                {mission.content.durationMinutes} min sugeridos
              </Badge>
              {mission.status === "closed" && (
                <Badge tone="warning">
                  Encerrada · entregas ainda são recebidas
                </Badge>
              )}
            </div>
            <p>{mission.content.objective}</p>
            <div className="team-strip">
              <Users size={18} />
              <strong>{group.name}</strong>
              <span>{group.members.length} participante(s)</span>
            </div>
          </article>
          {mission.content.challenge && (
            <ChallengeBrief challenge={mission.content.challenge} />
          )}
          <FocusPanel mission={mission} group={group} />
          <section className="card">
            <h2>Um passo de cada vez</h2>
            <p className="muted">
              Conversem, experimentem e marquem o que já realizaram.
            </p>
            <div className="steps">
              {mission.content.steps.map((step, i) => (
                <label
                  className={`step ${draft?.completedSteps.includes(i) ? "completed" : ""}`}
                  key={i}
                >
                  <input
                    type="checkbox"
                    disabled={!draft || loading}
                    checked={draft?.completedSteps.includes(i) || false}
                    onChange={(e) =>
                      edit({
                        completedSteps: e.target.checked
                          ? [...draft!.completedSteps, i]
                          : draft!.completedSteps.filter((s) => s !== i),
                      })
                    }
                  />
                  <div>
                    <span className="step-meta">
                      ETAPA {i + 1} ·{" "}
                      {step.mode === "off_screen"
                        ? "FORA DA TELA"
                        : "REGISTRO DIGITAL OU MEDIADO"}
                    </span>
                    <strong>{step.title}</strong>
                    <p>{step.instructions}</p>
                  </div>
                  {step.mode === "off_screen" ? (
                    <Users size={20} />
                  ) : (
                    <Monitor size={20} />
                  )}
                </label>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="row between">
              <h2>O que vocês descobriram?</h2>
              <Badge tone={draft?.status === "synced" ? "success" : "warning"}>
                {saving
                  ? "Salvando…"
                  : storageError
                    ? "Falha ao salvar"
                    : draft
                      ? !persistent && draft.status === "local"
                        ? "Somente nesta sessão"
                        : statuses[draft.status]
                      : "Preparando…"}
              </Badge>
            </div>
            <p className="muted">
              Uma boa ideia fica ainda melhor quando explicamos o caminho.
            </p>
            <ErrorText error={error} />
            {loading ? (
              <p role="status">Buscando sua entrega…</p>
            ) : !draft ? (
              <button
                className="button secondary"
                onClick={() => navigate(teacher ? "/missions" : "/")}
              >
                Voltar e tentar novamente
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                {questions.length > 0 && (
                  <>
                    <p className="muted">
                      Entreguem uma resposta para cada ponto-chave. Respostas
                      registradas:{" "}
                      {
                        questions.filter((q) =>
                          draft.answers?.some(
                            (a) => a.questionId === q.id && a.text.trim(),
                          ),
                        ).length
                      }
                      /{questions.length}.
                    </p>
                    <QuestionAnswers
                      questions={questions}
                      answers={draft.answers}
                      onChange={(answers) => edit({ answers })}
                    />
                  </>
                )}
                <label>
                  {questions.length
                    ? "Anotações extras (opcional)"
                    : "Produção da equipe"}
                  <textarea
                    aria-label="Produção da equipe"
                    required={!questions.length}
                    maxLength={12000}
                    rows={6}
                    placeholder="Contem o que investigaram e quais evidências apoiam a conclusão…"
                    value={draft.evidence}
                    onChange={(e) => edit({ evidence: e.target.value })}
                  />
                </label>
                <label>
                  Uma reflexão sobre a colaboração
                  <textarea
                    maxLength={2000}
                    rows={3}
                    placeholder="Como cada pessoa contribuiu? O que vocês fariam diferente?"
                    value={draft.reflection}
                    onChange={(e) => edit({ reflection: e.target.value })}
                  />
                </label>
                {draft.status === "conflict" && (
                  <div className="conflict-panel">
                    <h3>Seu grupo enviou outra versão</h3>
                    <p>
                      Seu texto acima continua salvo. Compare com a versão
                      recebida antes de continuar.
                    </p>
                    <blockquote>
                      <strong>
                        Versão recebida · {draft.conflict?.version ?? 0}
                      </strong>
                      <p>
                        {draft.conflict?.evidence ||
                          "Nenhuma entrega encontrada no servidor."}
                      </p>
                      <p>{draft.conflict?.reflection}</p>
                      <QuestionAnswers
                        questions={questions}
                        answers={draft.conflict?.answers}
                      />
                    </blockquote>
                    <div className="row wrap">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          void update((current) => ({
                            ...current,
                            drafts: {
                              ...current.drafts,
                              [key]: {
                                ...current.drafts[key]!,
                                baseVersion: draft.conflict?.version || 0,
                                submissionId:
                                  draft.conflict?.id || draft.submissionId,
                                pending: undefined,
                                conflict: undefined,
                                error: undefined,
                                status: "local",
                              },
                            },
                          })).catch(() => {})
                        }
                      >
                        Manter meu texto e preparar revisão
                      </button>
                      {draft.conflict && (
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() =>
                            void update((current) => ({
                              ...current,
                              drafts: {
                                ...current.drafts,
                                [key]: fromSubmission(draft.conflict!),
                              },
                            })).catch(() => {})
                          }
                        >
                          Substituir meu texto pela versão recebida
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {draft.error && draft.status !== "conflict" && (
                  <ErrorText error={draft.error} />
                )}
                <div className="row between wrap">
                  <small className="muted">
                    {teacher
                      ? "O mesmo reconhecimento vale para produções em papel ou orais."
                      : "A entrega e a devolutiva são compartilhadas com seu grupo."}
                  </small>
                  <button
                    className="button primary"
                    disabled={
                      !complete ||
                      submitting ||
                      !!storageError ||
                      draft.status === "conflict" ||
                      draft.status === "synced"
                    }
                  >
                    <CloudUpload size={18} />
                    {draft.pending
                      ? "Tentar sincronizar"
                      : online
                        ? "Enviar produção"
                        : "Guardar para enviar"}
                  </button>
                </div>
              </form>
            )}
          </section>
          {remote?.evaluation && (
            <section className="card feedback">
              <Badge tone="success">
                <MessageSquare size={14} /> DEVOLUTIVA DO PROFESSOR
              </Badge>
              <h2>Um olhar sobre sua descoberta</h2>
              <p>{remote.evaluation.feedback}</p>
              {remote.evaluation.scores.map((score) => (
                <div className="feedback-criterion" key={score.criterionId}>
                  <CheckCircle2 size={17} />
                  <span>
                    <strong>
                      {
                        mission.content.rubric.find(
                          (c) => c.id === score.criterionId,
                        )?.title
                      }
                    </strong>
                    <small>
                      {
                        mission.content.rubric.find(
                          (c) => c.id === score.criterionId,
                        )?.levels[score.level]
                      }
                    </small>
                  </span>
                </div>
              ))}
            </section>
          )}
        </section>
        <aside className="stack">
          <section className="card soft">
            <PencilLine className="section-icon" />
            <h3>Também vale no papel</h3>
            <p>{mission.content.offlineAlternative}</p>
          </section>
          <section className="card">
            <h3>Como vamos aprender</h3>
            <p className="muted">Critérios que guiam a devolutiva.</p>
            {mission.content.rubric.map((c) => (
              <details key={c.id}>
                <summary>{c.title}</summary>
                <ol>
                  {c.levels.map((level, i) => (
                    <li key={i}>{level}</li>
                  ))}
                </ol>
              </details>
            ))}
          </section>
          <section className="card">
            <h3>Combinados da equipe</h3>
            {group.members.map((m) => (
              <div className="member" key={m.id}>
                <span className="initial-avatar">{m.name.charAt(0)}</span>
                <div>
                  <strong>{m.name}</strong>
                  <small>{m.role}</small>
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
