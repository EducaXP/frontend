import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  HelpCircle,
  Leaf,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Save,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { useApp } from "../context";
import { api, ApiError, list } from "../api";
import type {
  Content,
  Dashboard,
  Group,
  Help,
  Mission,
  Submission,
} from "../types";
import { Badge, Empty, ErrorText, Modal, PageTitle } from "../ui";
import { template } from "../template";
import MissionWorkspace from "./MissionWorkspace";
import PlanningAssistantPanel from "./PlanningAssistant";

export default function Teacher({ path }: { path: string }) {
  const { data } = useApp();
  if (path === "/groups") return <GroupsPage />;
  if (path === "/planning" || path.startsWith("/edit/"))
    return (
      <Editor
        initial={data.missions.find((m) => m.id === path.split("/")[2])}
      />
    );
  if (path.startsWith("/review/")) {
    const mission = data.missions.find((m) => m.id === path.split("/")[2]);
    return mission ? (
      <Review key={mission.id} mission={mission} />
    ) : (
      <Empty title="Missão não encontrada">
        Atualize os dados da turma para continuar.
      </Empty>
    );
  }
  if (path.startsWith("/record/")) {
    const mission = data.missions.find((m) => m.id === path.split("/")[2]),
      group = data.groups.find((g) => g.id === path.split("/")[3]);
    return mission && group ? (
      <MissionWorkspace
        key={`${mission.id}:${group.id}`}
        mission={mission}
        group={group}
      />
    ) : (
      <Empty title="Selecione uma missão e um grupo">
        Use a lista de entregas para registrar uma produção mediada.
      </Empty>
    );
  }
  if (path === "/missions") return <Missions />;
  return <Overview />;
}
function Overview() {
  const { data, token, online, refresh, navigate, notice } = useApp();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [help, setHelp] = useState<Help[]>([]),
    [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<Help | null>(null),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false);
  const classroom = data.classrooms.find((c) => c.id === data.selectedClass);
  useEffect(() => {
    let active = true;
    setDashboard(null);
    setHelp([]);
    setError("");
    if (online && classroom)
      void Promise.all([
        api<Dashboard>(`/classrooms/${classroom.id}/dashboard`, token),
        list<Help>(`/classrooms/${classroom.id}/help`, token!),
      ])
        .then(([summary, items]) => {
          if (active) {
            setDashboard(summary);
            setHelp(items);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [data.selectedClass, data.updatedAt, token, online]);
  return (
    <>
      <PageTitle
        label="MAIS ESPAÇO PARA ENSINAR"
        title={`Olá, ${data.user.name.replace(/\s*\(.*\)/, "")}!`}
      >
        <button
          className="button primary"
          disabled={!classroom}
          onClick={() => navigate("/planning")}
        >
          <Plus size={18} /> Criar missão
        </button>
      </PageTitle>
      <ErrorText error={error} />
      {!classroom ? (
        <Empty title="Vamos preparar sua primeira turma?">
          Abra Turma e grupos para começar com seus estudantes.
        </Empty>
      ) : (
        <>
          <section className="teacher-hero">
            <div>
              <Badge tone="light">
                <GraduationCap size={15} /> APRENDIZAGEM EM MOVIMENTO
              </Badge>
              <h2>{classroom.name}</h2>
              <p>
                Organize descobertas. Acompanhe as produções.
                <br />
                Esteja presente onde a turma precisa de você.
              </p>
              <div className="row wrap">
                <span>
                  <Users size={17} /> {data.groups.length} equipes
                </span>
                <span className="join-code">
                  Código da turma <strong>{classroom.joinCode}</strong>
                </span>
              </div>
            </div>
            <div className="teacher-hero-art" aria-hidden="true">
              <BookOpen size={80} strokeWidth={1} />
              <Sparkles size={28} />
              <span>
                CONHECIMENTO
                <br />
                QUE SE CONSTRÓI JUNTO
              </span>
            </div>
          </section>
          <div className="stats-grid">
            {[
              {
                label: "Estudantes na turma",
                value: dashboard?.enrolledStudents,
                icon: Users,
                tone: "blue",
              },
              {
                label: "Produções para revisar",
                value: dashboard?.awaitingReview,
                icon: ClipboardCheck,
                tone: "violet",
              },
              {
                label: "Dúvidas em aberto",
                value: dashboard?.openHelpRequests,
                icon: MessageSquare,
                tone: "amber",
              },
              {
                label: "Produções recebidas",
                value: dashboard?.submissions,
                icon: CheckCircle2,
                tone: "green",
              },
            ].map((stat) => (
              <div className="card stat" key={stat.label}>
                <span className={`round-icon ${stat.tone}`}>
                  <stat.icon size={21} />
                </span>
                <strong>{stat.value ?? "—"}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          <div className="teacher-layout">
            <section className="stack">
              <div className="section-heading">
                <h2>No ritmo da turma</h2>
                <button
                  className="button text-button"
                  onClick={() => navigate("/missions")}
                >
                  Ver missões <ArrowRight size={16} />
                </button>
              </div>
              {data.missions
                .filter((m) => m.status === "published")
                .slice(0, 3)
                .map((m) => (
                  <article className="card mission-row" key={m.id}>
                    <div className="round-icon">
                      <BookOpen />
                    </div>
                    <div>
                      <Badge>{m.content.subject}</Badge>
                      <h3>{m.content.title}</h3>
                      <p>
                        {m.content.steps.length} etapas ·{" "}
                        {m.content.durationMinutes} min sugeridos
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => navigate(`/review/${m.id}`)}
                    >
                      Ver entregas <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              {!data.missions.some((m) => m.status === "published") && (
                <Empty title="A próxima missão começa com você">
                  Prepare uma atividade ou adapte o modelo de planejamento.
                </Empty>
              )}
              <div className="section-heading">
                <h2>Equipes em colaboração</h2>
                <button
                  className="button text-button"
                  onClick={() => navigate("/groups")}
                >
                  Organizar <ArrowRight size={16} />
                </button>
              </div>
              <div className="group-grid">
                {data.groups.map((g, i) => (
                  <article className="card group-tile" key={g.id}>
                    <span className={`group-symbol symbol-${i % 3}`}>
                      <Users size={25} />
                    </span>
                    <h3>{g.name}</h3>
                    <p>{g.members.length} participantes</p>
                    <div className="avatar-stack">
                      {g.members.slice(0, 5).map((m) => (
                        <span key={m.id} title={m.name}>
                          {m.name.charAt(0)}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <aside className="stack">
              <section className="card intervention">
                <Badge tone="violet">
                  <Leaf size={14} /> COMBINADOS DA AULA
                </Badge>
                <h3>Um respiro também ensina</h3>
                <p>
                  Proponha uma pausa para conversar, organizar ideias ou
                  descansar os olhos.
                </p>
                <button
                  className="button secondary full"
                  disabled={!online || busy}
                  onClick={() => {
                    setBusy(true);
                    void api(
                      `/classrooms/${classroom.id}/pause`,
                      token,
                      "PATCH",
                      { paused: !classroom.paused },
                    )
                      .then(() => refresh())
                      .then(() => notice("Combinado atualizado para a turma."))
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  {classroom.paused ? <Play size={17} /> : <Pause size={17} />}
                  {classroom.paused
                    ? "Retomar a atividade"
                    : "Combinar uma pausa"}
                </button>
              </section>
              <section className="card">
                <div className="row between">
                  <h3>Pedidos de orientação</h3>
                  <HelpCircle size={20} />
                </div>
                {!help.filter((h) => !h.resolvedAt).length && (
                  <p className="muted">
                    {online
                      ? "Nenhum pedido em aberto neste momento."
                      : "Conecte-se para consultar os pedidos."}
                  </p>
                )}
                {help
                  .filter((h) => !h.resolvedAt)
                  .map((h) => (
                    <div className="help-item" key={h.id}>
                      <strong>
                        {data.groups.find((g) => g.id === h.groupId)?.name ||
                          "Equipe"}
                      </strong>
                      <p>{h.message}</p>
                      <button
                        className="button ghost"
                        onClick={() => {
                          setReplyTo(h);
                          setAnswer("");
                        }}
                      >
                        Responder à equipe <ArrowRight size={15} />
                      </button>
                    </div>
                  ))}
              </section>
              <section className="planning-callout">
                <Sparkles size={24} />
                <h3>Uma ideia para começar</h3>
                <p>
                  Converse com o assistente para criar uma missão e uma rubrica.
                  Revise tudo no editor antes de publicar.
                </p>
                <button
                  className="button white full"
                  onClick={() => navigate("/planning")}
                >
                  Abrir planejamento
                </button>
                <small>Assistente de IA · editor e revisão docente</small>
              </section>
            </aside>
          </div>
        </>
      )}
      {replyTo && (
        <Modal title="Orientar a equipe" close={() => setReplyTo(null)}>
          <p>{replyTo.message}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void api(`/help/${replyTo.id}/resolve`, token, "PATCH", {
                answer,
              })
                .then(() => {
                  setReplyTo(null);
                  return refresh();
                })
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Sua orientação
              <textarea
                autoFocus
                required
                maxLength={2000}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || !answer.trim()}
            >
              Enviar orientação
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Missions() {
  const { data, navigate, online, token, refresh, notice } = useApp();
  const [error, setError] = useState(""),
    [closing, setClosing] = useState<Mission | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageTitle
        label="PERGUNTAS QUE VIRAM DESCOBERTAS"
        title="Missões da turma"
      >
        <button
          className="button primary"
          disabled={!data.selectedClass}
          onClick={() => navigate("/planning")}
        >
          <Plus size={17} /> Criar missão
        </button>
      </PageTitle>
      <ErrorText error={error} />
      <div className="stack">
        {data.missions.map((m) => (
          <article className="card mission-management" key={m.id}>
            <div>
              <div className="row wrap">
                <Badge
                  tone={
                    m.status === "published"
                      ? "success"
                      : m.status === "draft"
                        ? "violet"
                        : ""
                  }
                >
                  {m.status === "draft"
                    ? "Rascunho"
                    : m.status === "published"
                      ? "Publicada"
                      : "Encerrada"}
                </Badge>
                <span className="muted">
                  {m.content.subject} · {m.content.schoolYear}
                </span>
              </div>
              <h2>{m.content.title}</h2>
              <p>{m.content.objective}</p>
              <small className="muted">
                {m.content.steps.length} etapas · {m.content.durationMinutes}{" "}
                min · {m.content.rubric.length} critérios de avaliação
              </small>
            </div>
            <div className="row wrap">
              {m.status === "draft" ? (
                <button
                  className="button secondary"
                  onClick={() => navigate(`/edit/${m.id}`)}
                >
                  Revisar e publicar <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  className="button secondary"
                  onClick={() => navigate(`/review/${m.id}`)}
                >
                  Ver entregas <ArrowRight size={17} />
                </button>
              )}
              {m.status === "published" && (
                <button
                  className="button ghost"
                  disabled={!online}
                  onClick={() => setClosing(m)}
                >
                  Encerrar missão
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!data.missions.length && (
        <Empty title="Sua primeira missão está por vir">
          Comece com uma pergunta, adapte as etapas e publique para a turma.
        </Empty>
      )}
      {closing && (
        <Modal title="Encerrar esta missão?" close={() => setClosing(null)}>
          <p>
            A missão sairá da lista de atividades abertas. Produções pendentes
            por falta de conexão continuarão sendo recebidas para sua revisão.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void api(`/missions/${closing.id}/status`, token, "PATCH", {
                baseVersion: closing.version,
                status: "closed",
              })
                .then(() => {
                  setClosing(null);
                  return refresh();
                })
                .then(() => notice("Missão encerrada."))
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            Encerrar missão
          </button>
        </Modal>
      )}
    </>
  );
}

function Editor({ initial }: { initial?: Mission }) {
  const {
    data,
    token,
    online,
    update,
    refresh,
    navigate,
    notice,
    saving,
    storageError,
  } = useApp();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [theme, setTheme] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const planning = data.planning;
  useEffect(() => {
    if (!data.planning && data.selectedClass)
      void update((current) => ({
        ...current,
        planning: {
          content: initial?.content || template(),
          missionId: initial?.id,
          baseVersion: initial?.version,
          classroomId: data.selectedClass,
        },
      })).catch(() => {});
  }, [initial?.id, data.selectedClass, update]);
  if (!data.selectedClass)
    return (
      <Empty title="Escolha uma turma para planejar">
        Crie sua turma na área Turma e grupos.
      </Empty>
    );
  if (!planning) return <p role="status">Preparando o rascunho…</p>;
  if (initial && planning.missionId !== initial.id)
    return (
      <section className="card">
        <h2>Você já tem um rascunho em andamento</h2>
        <p>{planning.content.title}</p>
        <button
          className="button primary"
          onClick={() =>
            navigate(
              planning.missionId ? `/edit/${planning.missionId}` : "/planning",
            )
          }
        >
          Continuar rascunho atual
        </button>
        <button
          className="button ghost"
          onClick={() =>
            void update((current) => ({
              ...current,
              planning: {
                content: initial.content,
                missionId: initial.id,
                baseVersion: initial.version,
                classroomId: initial.classroomId,
              },
            })).catch(() => {})
          }
        >
          Descartar rascunho local e editar a missão escolhida
        </button>
      </section>
    );
  const content = planning.content;
  function change(patch: Partial<Content>) {
    void update((current) => ({
      ...current,
      planning: {
        ...current.planning!,
        content: { ...current.planning!.content, ...patch },
      },
    })).catch(() => {});
  }
  async function save(publish: boolean) {
    if (assistantBusy || busy || saving || storageError || !online) return;
    setBusy(true);
    setError("");
    try {
      const mission = planning!.missionId
        ? await api<Mission>(`/missions/${planning!.missionId}`, token, "PUT", {
            baseVersion: planning!.baseVersion,
            content,
          })
        : await api<Mission>(
            `/classrooms/${planning!.classroomId}/missions`,
            token,
            "POST",
            content,
          );
      // Persist the returned identity before publishing, so a publish retry cannot create a second mission.
      await update((current) => ({
        ...current,
        planning: {
          ...current.planning!,
          missionId: mission.id,
          baseVersion: mission.version,
        },
      }));
      if (publish)
        await api(`/missions/${mission.id}/status`, token, "PATCH", {
          baseVersion: mission.version,
          status: "published",
        });
      await update((current) => ({ ...current, planning: undefined }));
      await refresh();
      navigate("/missions");
      notice(
        publish
          ? "Missão publicada para a turma."
          : "Rascunho salvo no servidor.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="back-link" onClick={() => navigate("/missions")}>
        <ArrowLeft size={16} /> Voltar às missões
      </button>
      <PageTitle
        label="SUA MEDIAÇÃO FAZ A DIFERENÇA"
        title="Planejar uma descoberta"
      >
        <Badge tone="violet">
          <Sparkles size={14} /> Assistente e editor
        </Badge>
      </PageTitle>
      <div className="alert">
        <ShieldLabel />
        Toda proposta é um ponto de partida. Revise objetivos, instruções e
        critérios antes de publicar. O alinhamento à BNCC permanece pendente de
        verificação.
      </div>
      <PlanningAssistantPanel
        onBusyChange={setAssistantBusy}
        disabled={busy || saving || !!storageError}
      />
      <form
        className="stack editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <section className="card">
          <div className="section-heading">
            <h2>1. Uma pergunta para começar</h2>
            <Badge tone={saving ? "warning" : "success"}>
              {saving ? "Salvando…" : "Rascunho local"}
            </Badge>
          </div>
          <div className="template-prompt">
            <label>
              Tema para um novo modelo
              <input
                value={theme}
                maxLength={100}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex.: consumo de água na escola"
              />
            </label>
            <button
              type="button"
              className="button secondary"
              disabled={!theme.trim()}
              onClick={() => {
                const next = template(theme);
                change(next);
              }}
            >
              Aplicar modelo ao rascunho
            </button>
          </div>
          <label>
            Título da missão
            <input
              required
              maxLength={160}
              value={content.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          <label>
            Objetivo de aprendizagem
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={content.objective}
              onChange={(e) => change({ objective: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Componente curricular
              <input
                required
                maxLength={100}
                value={content.subject}
                onChange={(e) => change({ subject: e.target.value })}
              />
            </label>
            <label>
              Ano / etapa
              <input
                required
                maxLength={50}
                value={content.schoolYear}
                onChange={(e) => change({ schoolYear: e.target.value })}
              />
            </label>
            <label>
              Duração sugerida (min)
              <input
                type="number"
                min={1}
                max={240}
                required
                value={content.durationMinutes}
                onChange={(e) =>
                  change({ durationMinutes: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </section>
        <section className="card">
          <h2>2. O caminho da equipe</h2>
          {content.steps.map((step, i) => (
            <fieldset className="editor-step" key={i}>
              <legend>Etapa {i + 1}</legend>
              <div className="form-grid">
                <label>
                  Título da etapa
                  <input
                    required
                    maxLength={160}
                    value={step.title}
                    onChange={(e) =>
                      change({
                        steps: content.steps.map((s, j) =>
                          j === i ? { ...s, title: e.target.value } : s,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Forma de participação
                  <select
                    value={step.mode}
                    onChange={(e) =>
                      change({
                        steps: content.steps.map((s, j) =>
                          j === i
                            ? {
                                ...s,
                                mode: e.target.value as "screen" | "off_screen",
                              }
                            : s,
                        ),
                      })
                    }
                  >
                    <option value="off_screen">
                      Conversa / atividade fora da tela
                    </option>
                    <option value="screen">Registro digital ou mediado</option>
                  </select>
                </label>
              </div>
              <label>
                Instruções
                <textarea
                  required
                  maxLength={3000}
                  value={step.instructions}
                  onChange={(e) =>
                    change({
                      steps: content.steps.map((s, j) =>
                        j === i ? { ...s, instructions: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              {content.steps.length > 1 && (
                <button
                  type="button"
                  className="button ghost"
                  onClick={() =>
                    change({ steps: content.steps.filter((_, j) => j !== i) })
                  }
                >
                  Remover esta etapa
                </button>
              )}
            </fieldset>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={content.steps.length >= 12}
            onClick={() =>
              change({
                steps: [
                  ...content.steps,
                  { title: "", instructions: "", mode: "off_screen" },
                ],
              })
            }
          >
            <Plus size={16} /> Adicionar etapa
          </button>
          <label>
            Alternativa sem celular
            <textarea
              required
              maxLength={2000}
              value={content.offlineAlternative}
              onChange={(e) => change({ offlineAlternative: e.target.value })}
            />
          </label>
        </section>
        <section className="card">
          <h2>3. Critérios para uma boa devolutiva</h2>
          <p className="muted">
            Descreva o que pode ser observado em cada nível de aprendizagem.
          </p>
          {content.rubric.map((criterion, i) => (
            <fieldset className="editor-step" key={criterion.id}>
              <legend>Critério {i + 1}</legend>
              <label>
                Nome do critério
                <input
                  required
                  maxLength={120}
                  value={criterion.title}
                  onChange={(e) =>
                    change({
                      rubric: content.rubric.map((c, j) =>
                        j === i ? { ...c, title: e.target.value } : c,
                      ),
                    })
                  }
                />
              </label>
              <div className="rubric-grid">
                {criterion.levels.map((level, k) => (
                  <label key={k}>
                    Nível {k + 1}
                    <textarea
                      required
                      maxLength={800}
                      rows={3}
                      value={level}
                      onChange={(e) =>
                        change({
                          rubric: content.rubric.map((c, j) =>
                            j === i
                              ? {
                                  ...c,
                                  levels: c.levels.map((l, n) =>
                                    n === k ? e.target.value : l,
                                  ),
                                }
                              : c,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              {content.rubric.length > 1 && (
                <button
                  type="button"
                  className="button ghost"
                  onClick={() =>
                    change({ rubric: content.rubric.filter((_, j) => j !== i) })
                  }
                >
                  Remover critério
                </button>
              )}
            </fieldset>
          ))}
          <button
            className="button secondary"
            type="button"
            disabled={content.rubric.length >= 10}
            onClick={() =>
              change({
                rubric: [
                  ...content.rubric,
                  {
                    id: crypto.randomUUID(),
                    title: "",
                    levels: ["", "", "", ""],
                  },
                ],
              })
            }
          >
            <Plus size={16} /> Adicionar critério
          </button>
        </section>
        <ErrorText error={error} />
        <div className="editor-actions">
          <span>
            {online
              ? "A publicação libera a missão para a turma."
              : "Você pode editar offline. Para publicar, entre com conexão."}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={
              assistantBusy || busy || !online || saving || !!storageError
            }
            onClick={(e) => {
              if (e.currentTarget.form?.reportValidity()) void save(false);
            }}
          >
            <Save size={17} /> Salvar rascunho
          </button>
          <button
            className="button primary"
            disabled={
              assistantBusy || busy || !online || saving || !!storageError
            }
          >
            <Send size={17} />{" "}
            {busy ? "Salvando…" : "Revisado, publicar missão"}
          </button>
        </div>
      </form>
    </>
  );
}
function ShieldLabel() {
  return <CheckCircle2 size={20} />;
}

function Review({ mission }: { mission: Mission }) {
  const { data, token, online, navigate, notice } = useApp();
  const [submissions, setSubmissions] = useState<Submission[]>([]),
    [selected, setSelected] = useState<Submission | null>(null),
    [error, setError] = useState("");
  const [feedback, setFeedback] = useState(""),
    [scores, setScores] = useState<Record<string, number>>({}),
    [recognize, setRecognize] = useState(false),
    [busy, setBusy] = useState(false),
    [groupId, setGroupId] = useState(data.groups[0]?.id || "");
  useEffect(() => {
    let active = true;
    if (online && token)
      void list<Submission>(`/missions/${mission.id}/submissions`, token)
        .then((items) => {
          if (active) setSubmissions(items);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [mission.id, token, online]);
  async function select(submission: Submission) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Submission>(
        `/submissions/${submission.id}`,
        token,
      );
      setSelected(result);
      setFeedback(result.evaluation?.feedback || "");
      setScores(
        Object.fromEntries(
          (result.evaluation?.scores || []).map((s) => [
            s.criterionId,
            s.level,
          ]),
        ),
      );
      setRecognize(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function evaluate() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/submissions/${selected.id}/evaluations`, token, "POST", {
        submissionVersion: selected.version,
        feedback,
        scores: mission.content.rubric.map((c) => ({
          criterionId: c.id,
          level: scores[c.id],
        })),
        recognizeParticipation: recognize,
      });
      await select(selected);
      notice("Devolutiva publicada para a equipe.");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ALREADY_EVALUATED")
        await select(selected);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="back-link" onClick={() => navigate("/missions")}>
        <ArrowLeft size={16} /> Voltar às missões
      </button>
      <PageTitle
        label="UM OLHAR PARA CADA DESCOBERTA"
        title="Entregas e devolutivas"
      />
      <p className="subtitle">{mission.content.title}</p>
      <ErrorText error={error} />
      <div className="record-toolbar card">
        <div>
          <strong>Produção no papel ou apresentação oral?</strong>
          <p>Registre a síntese e reconheça a participação da mesma forma.</p>
        </div>
        <label>
          <span className="sr-only">Grupo para registro mediado</span>
          <select
            aria-label="Grupo para registro mediado"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          disabled={!groupId}
          onClick={() => navigate(`/record/${mission.id}/${groupId}`)}
        >
          <FileText size={16} /> Registrar produção
        </button>
      </div>
      <div className="review-layout">
        <section className="stack">
          <h2>
            Produções recebidas{" "}
            <span className="counter">{submissions.length}</span>
          </h2>
          {submissions.map((s) => (
            <button
              key={s.id}
              className={`card submission-choice ${selected?.id === s.id ? "selected" : ""}`}
              disabled={busy || !online}
              onClick={() => void select(s)}
            >
              <span className="round-icon">
                <Users size={21} />
              </span>
              <span>
                <strong>
                  {data.groups.find((g) => g.id === s.groupId)?.name ||
                    "Equipe"}
                </strong>
                <small>
                  Versão {s.version} ·{" "}
                  {s.channel === "teacher_mediated"
                    ? "Registro mediado"
                    : "Entrega digital"}
                </small>
                {s.receivedAfterClosure && (
                  <Badge tone="warning">Recebida após encerramento</Badge>
                )}
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
          {!submissions.length && (
            <Empty
              title={
                online ? "Aguardando as descobertas" : "Conecte-se para revisar"
              }
            >
              As produções enviadas pelos grupos aparecerão aqui.
            </Empty>
          )}
        </section>
        <section>
          {selected ? (
            <form
              className="card evaluation"
              onSubmit={(e) => {
                e.preventDefault();
                void evaluate();
              }}
            >
              <div className="row between">
                <h2>
                  {data.groups.find((g) => g.id === selected.groupId)?.name}
                </h2>
                <Badge tone={selected.evaluation ? "success" : "violet"}>
                  {selected.evaluation
                    ? "Avaliação publicada"
                    : `Revisando versão ${selected.version}`}
                </Badge>
              </div>
              <h3>Produção da equipe</h3>
              <blockquote className="evidence-text">
                {selected.evidence}
              </blockquote>
              {selected.reflection && (
                <>
                  <h3>Reflexão da equipe</h3>
                  <p className="evidence-text">{selected.reflection}</p>
                </>
              )}
              {mission.content.rubric.map((c) => (
                <label key={c.id}>
                  {c.title}
                  <select
                    required
                    disabled={!!selected.evaluation}
                    value={scores[c.id] ?? ""}
                    onChange={(e) =>
                      setScores({ ...scores, [c.id]: Number(e.target.value) })
                    }
                  >
                    <option value="" disabled>
                      Selecione a evidência observada
                    </option>
                    {c.levels.map((level, i) => (
                      <option key={i} value={i}>
                        Nível {i + 1}: {level}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Devolutiva para a equipe
                <textarea
                  required
                  maxLength={4000}
                  rows={4}
                  disabled={!!selected.evaluation}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Reconheça os avanços e indique um próximo passo…"
                />
              </label>
              {!selected.evaluation && (
                <>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={recognize}
                      onChange={(e) => setRecognize(e.target.checked)}
                    />
                    <span>
                      Reconhecer a participação de todos os integrantes com 100
                      XP por missão.
                    </span>
                  </label>
                  <small className="muted">
                    O reconhecimento é igual para entregas digitais e mediadas,
                    independentemente do nível da rubrica.
                  </small>
                  <button
                    className="button primary full"
                    disabled={busy || !online}
                  >
                    <CheckCircle2 size={17} /> Publicar devolutiva
                  </button>
                </>
              )}
              <ErrorText error={error} />
            </form>
          ) : (
            <div className="card review-empty">
              <ClipboardCheck size={50} />
              <h2>Uma devolutiva faz a diferença</h2>
              <p>
                Selecione uma produção para conhecer o caminho da equipe e
                orientar a próxima descoberta.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function GroupsPage() {
  const { data, token, online, refresh, notice } = useApp();
  const [students, setStudents] = useState<
      { id: string; name: string; alias: string }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<{
      alias: string;
      pin: string;
    } | null>(null),
    [members, setMembers] = useState<Record<string, string>>({});
  const [rotating, setRotating] = useState<Group | null>(null);
  useEffect(() => {
    let active = true;
    setMembers({});
    if (online && data.selectedClass)
      void list<{ id: string; name: string; alias: string }>(
        `/classrooms/${data.selectedClass}/students`,
        token!,
      )
        .then((items) => {
          if (active) setStudents(items);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    else setStudents([]);
    return () => {
      active = false;
    };
  }, [data.selectedClass, data.updatedAt, online, token]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const allocated = new Set(
    data.groups.flatMap((g) => g.members.map((m) => m.id)),
  );
  return (
    <>
      <PageTitle label="CADA PESSOA TEM UM LUGAR" title="Turma e grupos" />
      <ErrorText error={error} />
      <div className="management-grid">
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              values = new FormData(form);
            void run(async () => {
              const c = await api<{ id: string }>(
                "/classrooms",
                token,
                "POST",
                { name: values.get("name") },
              );
              form.reset();
              await refresh(c.id);
              notice("Turma criada.");
            });
          }}
        >
          <h2>
            <GraduationCap size={22} /> Nova turma
          </h2>
          <label>
            Nome da turma
            <input
              name="name"
              required
              maxLength={100}
              placeholder="Ex.: 9º ano A · Matemática"
            />
          </label>
          <button className="button secondary" disabled={busy || !online}>
            <Plus size={17} /> Criar turma
          </button>
        </form>
        {data.selectedClass && (
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                values = new FormData(form);
              void run(async () => {
                const result = await api<{ alias: string; pin: string }>(
                  `/classrooms/${data.selectedClass}/students`,
                  token,
                  "POST",
                  { name: values.get("name"), alias: values.get("alias") },
                );
                setCredentials(result);
                form.reset();
              });
            }}
          >
            <h2>
              <Users size={22} /> Incluir estudante
            </h2>
            <div className="form-grid">
              <label>
                Nome de exibição
                <input
                  required
                  name="name"
                  maxLength={80}
                  placeholder="Primeiro nome ou nome combinado"
                />
              </label>
              <label>
                Apelido para entrar
                <input
                  required
                  name="alias"
                  pattern="[a-z0-9_-]{2,24}"
                  placeholder="Ex.: enzo"
                />
              </label>
            </div>
            <p className="fine-print">
              Não é necessário e-mail. O PIN será exibido uma vez para entrega
              individual.
            </p>
            <button className="button secondary" disabled={busy || !online}>
              <Plus size={17} /> Incluir na turma
            </button>
          </form>
        )}
      </div>
      {data.selectedClass && (
        <>
          <div className="section-heading">
            <h2>Organizar uma equipe</h2>
            <span className="muted">Papéis que podem se alternar</span>
          </div>
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                values = new FormData(form);
              void run(async () => {
                await api(
                  `/classrooms/${data.selectedClass}/groups`,
                  token,
                  "POST",
                  {
                    name: values.get("name"),
                    members: Object.entries(members).map(
                      ([studentId, role]) => ({ studentId, role }),
                    ),
                  },
                );
                form.reset();
                setMembers({});
                notice("Equipe organizada.");
              });
            }}
          >
            <label>
              Nome da equipe
              <input
                name="name"
                required
                maxLength={80}
                placeholder="Ex.: Equipe Ipê"
              />
            </label>
            <div className="member-picker">
              {students
                .filter((s) => !allocated.has(s.id))
                .map((s) => (
                  <div className="picker-row" key={s.id}>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={s.id in members}
                        disabled={
                          !(s.id in members) &&
                          Object.keys(members).length >= 12
                        }
                        onChange={(e) => {
                          const next = { ...members };
                          if (e.target.checked)
                            next[s.id] = "Investigar e colaborar";
                          else delete next[s.id];
                          setMembers(next);
                        }}
                      />
                      {s.name}
                    </label>
                    {s.id in members && (
                      <input
                        required
                        aria-label={`Papel de ${s.name}`}
                        maxLength={80}
                        value={members[s.id]}
                        onChange={(e) =>
                          setMembers({ ...members, [s.id]: e.target.value })
                        }
                      />
                    )}
                  </div>
                ))}
            </div>
            {!students.some((s) => !allocated.has(s.id)) && (
              <p className="muted">
                Todos os estudantes listados já estão em equipes. Inclua novos
                participantes acima.
              </p>
            )}
            <button
              className="button primary"
              disabled={busy || !online || !Object.keys(members).length}
            >
              <Users size={17} /> Formar equipe
            </button>
          </form>
          <div className="section-heading">
            <h2>Equipes da turma</h2>
          </div>
          <div className="group-grid">
            {data.groups.map((g) => (
              <article className="card" key={g.id}>
                <h3>{g.name}</h3>
                {g.members.map((m) => (
                  <div className="member" key={m.id}>
                    <span className="initial-avatar">{m.name.charAt(0)}</span>
                    <div>
                      <strong>{m.name}</strong>
                      <small>{m.role}</small>
                    </div>
                  </div>
                ))}
                <button
                  className="button ghost full"
                  disabled={!online}
                  onClick={() => setRotating(structuredClone(g))}
                >
                  Alternar papéis
                </button>
              </article>
            ))}
          </div>
          <section className="card roster">
            <h2>Acessos dos estudantes</h2>
            {students.map((s) => (
              <div className="roster-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <small>Apelido: {s.alias}</small>
                </div>
                <button
                  className="button ghost"
                  disabled={!online || busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Gerar outro PIN para ${s.name}? Os acessos anteriores serão encerrados.`,
                      )
                    )
                      void run(async () => {
                        const result = await api<{ pin: string }>(
                          `/classrooms/${data.selectedClass}/students/${s.id}/reset-pin`,
                          token,
                          "POST",
                        );
                        setCredentials({ alias: s.alias, pin: result.pin });
                      });
                  }}
                >
                  Gerar novo PIN
                </button>
              </div>
            ))}
          </section>
        </>
      )}
      {credentials && (
        <Modal
          title="Acesso individual do estudante"
          close={() => setCredentials(null)}
        >
          <p>Entregue estes dados apenas à pessoa correspondente.</p>
          <div className="credential">
            <span>
              Apelido <strong>{credentials.alias}</strong>
            </span>
            <span>
              PIN <strong>{credentials.pin}</strong>
            </span>
          </div>
          <p>O PIN não ficará disponível nesta tela depois de fechar.</p>
        </Modal>
      )}
      {rotating && (
        <Modal
          title={`Papéis · ${rotating.name}`}
          close={() => setRotating(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api(`/groups/${rotating.id}/roles`, token, "PUT", {
                  members: rotating.members.map((m) => ({
                    studentId: m.id,
                    role: m.role,
                  })),
                });
                setRotating(null);
              });
            }}
          >
            {rotating.members.map((m, i) => (
              <label key={m.id}>
                Papel de {m.name}
                <input
                  required
                  maxLength={80}
                  value={m.role}
                  onChange={(e) =>
                    setRotating({
                      ...rotating,
                      members: rotating.members.map((member, j) =>
                        i === j ? { ...member, role: e.target.value } : member,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <button className="button primary" disabled={busy}>
              Salvar papéis
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
