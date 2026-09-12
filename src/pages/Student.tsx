import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Compass,
  Headphones,
  Leaf,
  LockKeyhole,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Backpack,
} from "lucide-react";
import { useApp } from "../context";
import { api, list } from "../api";
import type { Avatar, Help } from "../types";
import { Badge, Empty, ErrorText, MissionArt, PageTitle } from "../ui";
import MissionWorkspace from "./MissionWorkspace";

export default function Student({ path }: { path: string }) {
  const { data, navigate } = useApp();
  const group = data.groups[0];
  if (path.startsWith("/mission/")) {
    const mission = data.missions.find((m) => m.id === path.split("/")[2]);
    return mission && group ? (
      <MissionWorkspace
        key={`${mission.id}:${group.id}`}
        mission={mission}
        group={group}
      />
    ) : (
      <Empty title="Missão indisponível">
        Atualize seu espaço ou peça ao professor para organizar seu grupo.
      </Empty>
    );
  }
  if (path === "/avatar") return <AvatarPage />;
  if (path === "/team") return <TeamPage />;
  const missions = data.missions.filter((m) => m.status === "published");
  const closed = data.missions.filter((m) => m.status === "closed");
  const firstName = data.user.name.split(" ")[0];
  const paused = data.classrooms.find(
    (c) => c.id === data.selectedClass,
  )?.paused;
  return (
    <>
      <PageTitle label="CADA DESCOBERTA CONTA" title={`Olá, ${firstName}!`}>
        <span className="greeting-sub">Que ideia vamos explorar hoje?</span>
      </PageTitle>
      {paused && (
        <div className="alert warning">
          <Leaf size={20} /> A turma está em uma pausa combinada. Aproveite para
          conversar e descansar os olhos.
        </div>
      )}
      <section className="student-hero">
        <div>
          <Badge tone="light">
            <Users size={14} /> JUNTOS A GENTE VAI MAIS LONGE
          </Badge>
          <h2>
            Sua próxima conquista
            <br />
            começa com uma <em>ideia.</em>
          </h2>
          <p>
            Investigue com sua equipe. Escute outras perspectivas.
            <br className="desktop-only" /> Transforme descobertas em algo que
            vocês criaram juntos.
          </p>
          <button
            className="button white"
            disabled={!missions.length || !group}
            onClick={() => navigate(`/mission/${missions[0]!.id}`)}
          >
            Explorar minha missão <ArrowRight size={18} />
          </button>
        </div>
        <MissionArt />
      </section>
      <div className="student-layout">
        <section>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                HORA DE COLOCAR AS IDEIAS EM MOVIMENTO
              </span>
              <h2>
                Missões da turma{" "}
                <span className="counter">{missions.length}</span>
              </h2>
            </div>
            <Compass className="muted" />
          </div>
          {!group && (
            <div className="alert">
              Seu professor ainda está organizando sua equipe. Você poderá
              participar com um aparelho compartilhado.
            </div>
          )}
          {!missions.length && (
            <Empty title="Novas descobertas estão a caminho">
              Assim que o professor publicar uma missão, ela aparecerá aqui.
            </Empty>
          )}
          <div className="mission-grid">
            {[...missions, ...closed].map((mission, i) => {
              const draft = Object.values(data.drafts).find(
                (d) => d.missionId === mission.id && d.groupId === group?.id,
              );
              return (
                <article className="card mission-card" key={mission.id}>
                  <div className={`mission-cover cover-${i % 3}`}>
                    <BookOpen size={46} strokeWidth={1.3} />
                    <span>MISSÃO {String(i + 1).padStart(2, "0")}</span>
                    <Sparkles size={28} />
                  </div>
                  <div className="mission-body">
                    <div className="row between">
                      <Badge>{mission.content.subject}</Badge>
                      <span className="duration">
                        <Clock3 size={14} /> {mission.content.durationMinutes}{" "}
                        min
                      </span>
                    </div>
                    <h3>{mission.content.title}</h3>
                    <p>{mission.content.objective}</p>
                    <div className="mission-meta">
                      <span>
                        <Users size={16} />{" "}
                        {group?.name || "Equipe em preparação"}
                      </span>
                      <Badge
                        tone={draft?.status === "synced" ? "success" : "violet"}
                      >
                        {draft?.status === "synced"
                          ? "Entregue"
                          : draft?.pending
                            ? "Na fila de envio"
                            : mission.status === "closed"
                              ? "Encerrada"
                              : `${mission.content.steps.length} etapas`}
                      </Badge>
                    </div>
                    <button
                      className="button secondary full"
                      disabled={!group}
                      onClick={() => navigate(`/mission/${mission.id}`)}
                    >
                      {draft ? "Continuar descoberta" : "Conhecer a missão"}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="stack student-aside">
          <section className="card team-card">
            <div className="row between">
              <h3>Sua equipe</h3>
              <Users size={20} />
            </div>
            <div className="avatar-stack">
              {group?.members.slice(0, 5).map((m) => (
                <span key={m.id}>{m.name.charAt(0)}</span>
              ))}
            </div>
            <h2>{group?.name || "Quase tudo pronto"}</h2>
            <p>
              {group
                ? "Cada pessoa traz um olhar. Juntos, vocês constroem a descoberta."
                : "O professor vai ajudar a combinar os participantes."}
            </p>
            <button
              className="button text-button"
              onClick={() => navigate("/team")}
            >
              Ver nossos combinados <ArrowRight size={16} />
            </button>
          </section>
          <section className="card discovery-card">
            <div className="round-icon">
              <Sparkles />
            </div>
            <span className="eyebrow">SEU PROGRESSO</span>
            <h2>
              {data.avatar?.xp || 0} <small>XP</small>
            </h2>
            <p>
              Conquistas por participar e colaborar. Cada missão é uma nova
              oportunidade.
            </p>
            <button
              className="button ghost full"
              onClick={() => navigate("/avatar")}
            >
              Personalizar meu avatar <ArrowRight size={16} />
            </button>
          </section>
          <section className="help-card">
            <MessageCircle size={26} />
            <h3>Uma dúvida no caminho?</h3>
            <p>Chame o professor. Pedir ajuda também faz parte de aprender.</p>
            <button
              className="button secondary full"
              onClick={() => navigate("/team")}
            >
              Pedir uma orientação
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
function TeamPage() {
  const { data, token, online, notice } = useApp();
  const [help, setHelp] = useState<Help[]>([]),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const group = data.groups[0];
  const load = async () => {
    if (token && online && data.selectedClass)
      setHelp(
        await list<Help>(`/classrooms/${data.selectedClass}/help`, token),
      );
  };
  useEffect(() => {
    let active = true;
    if (token && online && data.selectedClass)
      void list<Help>(`/classrooms/${data.selectedClass}/help`, token)
        .then((items) => {
          if (active) setHelp(items);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [token, online, data.selectedClass]);
  return (
    <>
      <PageTitle label="NINGUÉM APRENDE SOZINHO" title="Minha equipe" />
      {!group ? (
        <Empty title="Sua equipe está sendo preparada">
          Peça ao professor para organizar os participantes e os papéis.
        </Empty>
      ) : (
        <div className="detail-layout">
          <section className="card">
            <Badge tone="success">
              <Users size={14} /> CONSTRUÇÃO COLETIVA
            </Badge>
            <h2>{group.name}</h2>
            <p className="muted">
              Estes são os papéis combinados. O professor pode ajudar a
              alterná-los durante a jornada.
            </p>
            {group.members.map((m) => (
              <div className="member large" key={m.id}>
                <span className="initial-avatar">{m.name.charAt(0)}</span>
                <div>
                  <strong>
                    {m.name}
                    {m.id === data.user.id ? " · você" : ""}
                  </strong>
                  <small>{m.role}</small>
                </div>
              </div>
            ))}
            <div className="alert">
              <ShieldCheck size={18} /> Compartilhar o aparelho também é uma
              forma de participar.
            </div>
          </section>
          <section className="stack">
            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                void api(`/groups/${group.id}/help`, token, "POST", {
                  message: text,
                })
                  .then(() => {
                    setText("");
                    notice("Pedido enviado ao professor.");
                    return load();
                  })
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              <h2>Uma ajuda para continuar</h2>
              <label>
                Qual é a dúvida da equipe?
                <textarea
                  rows={4}
                  required
                  maxLength={1000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Contem em qual parte precisam de orientação…"
                />
              </label>
              <ErrorText error={error} />
              <button
                className="button primary full"
                disabled={!online || busy || !text.trim()}
              >
                <Send size={17} /> Enviar pedido de ajuda
              </button>
              {!online && (
                <p className="muted">
                  Os pedidos de ajuda precisam de conexão.
                </p>
              )}
            </form>
            {help.map((h) => (
              <article className="card" key={h.id}>
                <Badge tone={h.resolvedAt ? "success" : "warning"}>
                  {h.resolvedAt
                    ? "Professor respondeu"
                    : "Aguardando orientação"}
                </Badge>
                <p>{h.message}</p>
                {h.answer && <blockquote>{h.answer}</blockquote>}
              </article>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
function AvatarPage() {
  const { data, token, online, update, notice } = useApp();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const avatar = data.avatar;
  const visuals = {
    basic: Compass,
    headphones: Headphones,
    cape: ShieldCheck,
    backpack: Backpack,
  };
  if (!avatar)
    return (
      <Empty title="Seu avatar está sendo preparado">
        Atualize seu espaço com conexão para buscar as opções de personalização.
      </Empty>
    );
  const Equipped = visuals[avatar.itemId as keyof typeof visuals] || Compass;
  async function equip(itemId: string, ecoMode = avatar!.ecoMode) {
    setBusy(true);
    setError("");
    try {
      await api("/me/avatar", token, "PUT", { itemId, ecoMode });
      const result = await api<Avatar>("/me/avatar", token);
      await update((current) => ({ ...current, avatar: result }));
      notice("Seu visual foi atualizado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle label="DO SEU JEITO" title="Meu avatar e minhas conquistas" />
      <ErrorText error={error} />
      <div className="avatar-layout">
        <section className="card avatar-preview">
          <Badge tone="violet">EXPLORADOR DE IDEIAS</Badge>
          <div className="avatar-portrait">
            <span>{data.user.name.charAt(0)}</span>
            <img
              className="student-portrait-asset"
              src="/assets/student-avatar.png"
              alt="Avatar ilustrado do EducaXP"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
            <div className="equipped">
              <Equipped size={38} />
            </div>
            <i />
            <b>✦</b>
          </div>
          <h2>{data.user.name}</h2>
          <p>{data.groups[0]?.name || "Uma jornada em construção"}</p>
          <div className="xp-total">
            <Sparkles size={24} />
            <strong>{avatar.xp}</strong>
            <span>XP conquistados</span>
          </div>
          <p className="fine-print">{avatar.rewardRule}</p>
        </section>
        <section>
          <div className="section-heading">
            <h2>Seu armário de descobertas</h2>
          </div>
          <div className="cosmetic-grid">
            {avatar.catalog.map((item) => {
              const Icon = visuals[item.id as keyof typeof visuals] || Sparkles;
              const equipped = item.id === avatar.itemId;
              return (
                <article
                  className={`card cosmetic ${equipped ? "selected" : ""}`}
                  key={item.id}
                >
                  <div className={`cosmetic-art item-${item.id}`}>
                    <Icon size={65} strokeWidth={1.4} />
                  </div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.requiredXp === 0
                      ? "Disponível desde o começo"
                      : `Desbloqueia com ${item.requiredXp} XP`}
                  </p>
                  <button
                    className={`button full ${equipped ? "ghost" : "secondary"}`}
                    disabled={equipped || !item.unlocked || busy || !online}
                    onClick={() => void equip(item.id)}
                  >
                    {equipped ? (
                      <Check size={16} />
                    ) : !item.unlocked ? (
                      <LockKeyhole size={16} />
                    ) : null}
                    {equipped
                      ? "Em uso"
                      : item.unlocked
                        ? "Usar este visual"
                        : "Ainda por descobrir"}
                  </button>
                </article>
              );
            })}
          </div>
          <label className="card check-label eco-option">
            <input
              type="checkbox"
              checked={avatar.ecoMode}
              disabled={!online || busy}
              onChange={(e) => void equip(avatar.itemId, e.target.checked)}
            />
            <Leaf size={23} />
            <span>
              <strong>Modo econômico</strong>
              <small>
                Reduz movimentos decorativos para uma experiência mais
                tranquila.
              </small>
            </span>
          </label>
        </section>
      </div>
    </>
  );
}
