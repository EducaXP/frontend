import { useEffect, useState } from "react";
import { Pause, Play, Sparkles, Leaf, CheckCircle2 } from "lucide-react";
import { useApp } from "../context";
import { emptyFocus, focusRemaining } from "../focus";
import { draftKey, type FocusDraft, type Group, type Mission } from "../types";
import { ErrorText } from "../ui";
export default function FocusPanel({
  mission,
  group,
}: {
  mission: Mission;
  group: Group;
}) {
  const { data, update, sync, online, saving, storageError, persistent } =
    useApp();
  const key = draftKey(mission.id, group.id),
    draft = data.focus?.[key];
  const record = data.focusRecords?.find(
    (r) => r.missionId === mission.id && r.groupId === group.id,
  );
  const [now, setNow] = useState(Date.now()),
    [error, setError] = useState("");
  const paused = !!data.classrooms.find((c) => c.id === data.selectedClass)
    ?.paused;
  useEffect(() => {
    if (!draft?.endsAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [draft?.endsAt]);
  async function change(patch: Partial<FocusDraft>) {
    try {
      await update((current) => ({
        ...current,
        focus: {
          ...current.focus,
          [key]: { ...(current.focus?.[key] || emptyFocus()), ...patch },
        },
      }));
      setError("");
      return true;
    } catch {
      setError(
        "Não foi possível salvar o combinado. Mantenha esta tela aberta.",
      );
      return false;
    }
  }
  const remaining = draft ? focusRemaining(draft, now) : 1500;
  const running = !!draft?.endsAt && remaining > 0;
  const locked = !!draft?.pending || draft?.status === "synced" || !!record;
  async function submit() {
    if (!draft || locked) return;
    const saved = await change({
      status: "queued",
      endsAt: undefined,
      remaining: focusRemaining(draft),
      pending: {
        operationId: crypto.randomUUID(),
        missionId: mission.id,
        groupId: group.id,
        goal: draft.goal,
        strategy: draft.strategy,
        reflection: draft.reflection,
        channel: data.user.role === "teacher" ? "teacher_mediated" : "digital",
      },
    });
    if (saved) await sync();
  }
  return (
    <section className="focus-card" aria-label="Modo foco em equipe">
      <div className="row between wrap">
        <span className="focus-label">
          <Leaf size={16} /> MODO FOCO EM EQUIPE
        </span>
        <strong className="focus-bonus">
          <Sparkles size={15} /> +25 XP por pessoa
        </strong>
      </div>
      <div className="focus-summary">
        <div
          className="focus-clock"
          role="timer"
          aria-label="Tempo sugerido restante"
        >
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
          <small>tempo sugerido</small>
        </div>
        <div>
          <h2>Um combinado, uma descoberta</h2>
          <p>
            {group.name} · {mission.content.title}
          </p>
          <small>
            Definam um objetivo e contem o que ajudou a equipe. O bônus vale uma
            vez por missão, inclusive no papel.
          </small>
        </div>
      </div>
      <p className="focus-note">
        O cronômetro é opcional. Vocês podem pausar, fechar a tela ou concluir
        antes. O XP reconhece o registro do combinado e da reflexão, sem medir
        atenção.
      </p>
      {paused && (
        <p className="focus-note">
          A turma combinou uma pausa. Descansem e retomem quando estiverem
          prontos.
        </p>
      )}
      {!draft && !record ? (
        <button
          className="button white"
          onClick={() => void change(emptyFocus())}
        >
          Preparar nosso combinado <Play size={16} />
        </button>
      ) : (
        <>
          {(record || draft?.status === "synced") && (
            <p className="focus-earned" role="status">
              <CheckCircle2 size={20} /> Combinado registrado · bônus de 25 XP
              por integrante reconhecido
            </p>
          )}
          {draft?.status === "queued" && (
            <p role="status">
              Reflexão salva · aguardando envio para confirmar o XP
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="focus-form"
          >
            <label>
              Nosso objetivo neste ciclo
              <input
                required
                maxLength={300}
                value={draft?.goal ?? record?.goal ?? ""}
                readOnly={locked}
                onChange={(e) => void change({ goal: e.target.value })}
                placeholder="Ex.: comparar duas hipóteses com a equipe"
              />
            </label>
            <label>
              Nosso combinado para ajudar no foco
              <input
                required
                maxLength={300}
                value={draft?.strategy ?? record?.strategy ?? ""}
                readOnly={locked}
                onChange={(e) => void change({ strategy: e.target.value })}
              />
            </label>
            {!locked && (
              <div className="row wrap">
                <label>
                  Tempo sugerido
                  <select
                    value={draft?.remaining || 1500}
                    disabled={running}
                    onChange={(e) =>
                      void change({
                        remaining: Number(e.target.value),
                        endsAt: undefined,
                      })
                    }
                  >
                    {![300, 600, 1500].includes(draft?.remaining || 1500) && (
                      <option value={draft?.remaining}>
                        Retomar tempo restante
                      </option>
                    )}
                    <option value={300}>5 minutos</option>
                    <option value={600}>10 minutos</option>
                    <option value={1500}>25 minutos</option>
                  </select>
                </label>
                <button
                  className="button white"
                  type="button"
                  onClick={() => {
                    setNow(Date.now());
                    void change(
                      running
                        ? {
                            endsAt: undefined,
                            remaining: focusRemaining(draft!),
                          }
                        : {
                            endsAt:
                              Date.now() + (draft?.remaining || 1500) * 1000,
                          },
                    );
                  }}
                >
                  {running ? <Pause size={16} /> : <Play size={16} />}{" "}
                  {running ? "Pausar cronômetro" : "Iniciar cronômetro"}
                </button>
              </div>
            )}
            <label>
              O que ajudou a equipe? O que podemos ajustar?
              <textarea
                required
                maxLength={1500}
                rows={3}
                value={draft?.reflection ?? record?.reflection ?? ""}
                readOnly={locked}
                onChange={(e) => void change({ reflection: e.target.value })}
                placeholder="Contem uma estratégia que funcionou ou algo que vão tentar diferente."
              />
            </label>
            <ErrorText error={error || draft?.error || ""} />
            {!locked && (
              <div className="row between wrap">
                <small>
                  {persistent
                    ? "Combinado salvo neste aparelho"
                    : "Combinado somente nesta sessão"}
                </small>
                <button
                  className="button white"
                  disabled={
                    saving ||
                    !!storageError ||
                    !draft?.goal.trim() ||
                    !draft.strategy.trim() ||
                    !draft.reflection.trim()
                  }
                >
                  <Sparkles size={16} />
                  {online
                    ? "Registrar reflexão e receber XP"
                    : "Guardar reflexão para enviar"}
                </button>
              </div>
            )}
          </form>
        </>
      )}
    </section>
  );
}
