import {
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Compass,
  Download,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { api, ApiError, list } from "./api";
import { AppContext } from "./context";
import { applyReceipt, hasWork } from "./sync";
import type {
  Avatar,
  Classroom,
  Credentials,
  Group,
  Mission,
  Submission,
  User,
  Workspace,
} from "./types";
import { Badge, Brand, ErrorText, MissionArt, Modal } from "./ui";
import { Vault } from "./vault";
import { SessionAccess } from "./session-access";

const Student = lazy(() => import("./pages/Student"));
const Teacher = lazy(() => import("./pages/Teacher"));
interface Session {
  release?: () => void;
  id: string;
  token: string | null;
  access: SessionAccess;
  vault: Vault | null;
  data: Workspace;
}
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";

function Login({
  onLogin,
}: {
  onLogin: (credentials: Credentials, prepare: boolean) => Promise<void>;
}) {
  const [role, setRole] = useState<Credentials["role"]>("student");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [prepare, setPrepare] = useState(true);
  const form = useRef<HTMLFormElement>(null);
  async function enter() {
    if (!form.current?.reportValidity()) return;
    const fields = new FormData(form.current);
    setBusy(true);
    setError("");
    try {
      await onLogin(
        {
          role,
          login: String(fields.get("login") || "").trim(),
          alias: String(fields.get("alias") || "")
            .trim()
            .toLowerCase(),
          classCode: String(fields.get("classCode") || "")
            .trim()
            .toUpperCase(),
          secret: String(fields.get("secret") || ""),
        },
        prepare,
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <Brand />
        <div className="story-copy">
          <Badge tone="light">
            <Sparkles size={14} /> SUA PRÓXIMA DESCOBERTA COMEÇA AQUI
          </Badge>
          <h1>
            Grandes ideias.
            <br />
            Conquistas <em>coletivas.</em>
          </h1>
          <p>
            Um espaço para investigar, criar e aprender juntos. Cada pessoa tem
            um jeito de contribuir.
          </p>
          <MissionArt />
          <div className="story-features">
            <span>
              <Users /> Aprenda em equipe
            </span>
            <span>
              <CloudOff /> Leve suas missões offline
            </span>
            <span>
              <ShieldCheck /> Seu ritmo importa
            </span>
          </div>
        </div>
        <small>EDUCAXP · TECNOLOGIA A FAVOR DA APRENDIZAGEM</small>
      </section>
      <section className="login-panel">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-form">
          <span className="eyebrow">BOM TER VOCÊ POR AQUI</span>
          <h2>Vamos aprender?</h2>
          <p className="muted">Entre no seu espaço e continue a jornada.</p>
          <div className="role-tabs" aria-label="Tipo de acesso">
            <button
              type="button"
              aria-pressed={role === "student"}
              onClick={() => {
                setRole("student");
                setError("");
              }}
            >
              <Compass size={18} /> Sou estudante
            </button>
            <button
              type="button"
              aria-pressed={role === "teacher"}
              onClick={() => {
                setRole("teacher");
                setError("");
              }}
            >
              <GraduationCap size={18} /> Sou professor
            </button>
          </div>
          <form
            ref={form}
            key={role}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void enter();
            }}
          >
            {role === "teacher" ? (
              <label>
                Login do professor
                <input
                  name="login"
                  autoComplete="username"
                  maxLength={100}
                  placeholder="Seu login"
                  required
                />
              </label>
            ) : (
              <>
                <label>
                  Código da turma
                  <input
                    name="classCode"
                    autoCapitalize="characters"
                    maxLength={20}
                    placeholder="Código entregue pelo professor"
                    required
                  />
                </label>
                <label>
                  Seu apelido
                  <input
                    name="alias"
                    autoComplete="username"
                    maxLength={24}
                    placeholder="Como você entra na turma"
                    required
                  />
                </label>
              </>
            )}
            <label>
              {role === "student" ? "Seu PIN de 6 números" : "Sua senha"}
              <input
                name="secret"
                type="password"
                inputMode={role === "student" ? "numeric" : undefined}
                pattern={role === "student" ? "[0-9]{6}" : undefined}
                minLength={role === "student" ? 6 : 1}
                maxLength={role === "student" ? 6 : 128}
                autoComplete="current-password"
                placeholder={role === "student" ? "••••••" : "Sua senha"}
                required
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={prepare}
                onChange={(e) => setPrepare(e.target.checked)}
              />{" "}
              Preparar acesso offline neste aparelho
            </label>
            <ErrorText error={error} />
            <button className="button primary full" disabled={busy}>
              {busy ? "Preparando seu espaço…" : "Entrar e continuar"}
              <ArrowRight size={18} />
            </button>
            <p className="fine-print">
              Sem conexão? Seu conteúdo já preparado abre pelo mesmo botão.
            </p>
          </form>
          <div className="login-help">
            <HelpCircle size={20} />
            <p>
              {role === "student"
                ? "Ainda não tem acesso? Peça o código e seu PIN ao professor. Você também pode participar em um aparelho compartilhado."
                : "Use o acesso disponibilizado pela escola."}
            </p>
          </div>
          <p className="fine-print">
            O primeiro acesso precisa de conexão. Em aparelhos compartilhados,
            encerre seu acesso antes de passar para outra pessoa.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    ref = useRef<Session | null>(null);
  const [online, setOnline] = useState(navigator.onLine),
    [path, setPath] = useState(location.hash.slice(1) || "/");
  const [toast, setToast] = useState(""),
    [saving, setSaving] = useState(false),
    [storageError, setStorageError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [leave, setLeave] = useState(false),
    [install, setInstall] = useState<InstallEvent | null>(null);
  const syncing = useRef(false),
    saves = useRef(0),
    mounted = useRef(true);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  const notice = useCallback((text: string) => setToast(text), []);
  const navigate = useCallback((value: string) => {
    location.hash = value;
  }, []);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine),
      hash = () => {
        setPath(location.hash.slice(1) || "/");
        window.scrollTo(0, 0);
      };
    const installPrompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("hashchange", hash);
    window.addEventListener("beforeinstallprompt", installPrompt);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("beforeinstallprompt", installPrompt);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (
        saves.current > 0 ||
        (ref.current &&
          !ref.current.vault &&
          (Object.values(ref.current.data.drafts).some(hasWork) ||
            !!ref.current.data.planning))
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);
  const update = useCallback(async (fn: (data: Workspace) => Workspace) => {
    const current = ref.current;
    if (!current) return;
    const next = { ...current, data: fn(current.data) };
    ref.current = next;
    setSession(next);
    if (!next.vault) return;
    saves.current++;
    setSaving(true);
    try {
      await next.vault.save(next.data);
      if (ref.current?.id === next.id) setStorageError("");
    } catch (error) {
      if (ref.current?.id === next.id)
        setStorageError(
          "Não foi possível salvar neste aparelho. Libere espaço e mantenha esta tela aberta até enviar seu trabalho.",
        );
      throw error;
    } finally {
      saves.current--;
      if (mounted.current) setSaving(saves.current > 0);
    }
  }, []);
  const refresh = useCallback(
    async (classId?: string) => {
      const current = ref.current;
      if (!current?.token)
        throw new ApiError(
          401,
          "REAUTHENTICATE",
          "Aguardando conexão para atualizar seu espaço.",
        );
      const classrooms = await list<Classroom>("/classrooms", current.token);
      const selectedClass =
        classrooms.find((c) => c.id === (classId || current.data.selectedClass))
          ?.id ||
        classrooms[0]?.id ||
        "";
      const [missions, groups, avatar] = await Promise.all([
        selectedClass
          ? list<Mission>(
              `/classrooms/${selectedClass}/missions`,
              current.token,
            )
          : [],
        selectedClass
          ? list<Group>(`/classrooms/${selectedClass}/groups`, current.token)
          : [],
        current.data.user.role === "student"
          ? api<Avatar>("/me/avatar", current.token)
          : undefined,
      ]);
      if (ref.current?.id !== current.id) return;
      await update((data) => ({
        ...data,
        classrooms,
        selectedClass,
        missions,
        groups,
        avatar,
        updatedAt: Date.now(),
      }));
    },
    [update],
  );
  const sync = useCallback(async () => {
    let current = ref.current;
    if (syncing.current || !navigator.onLine || !current) return;
    syncing.current = true;
    try {
      const started = current;
      const authenticated = await started.access.ensure();
      if (ref.current?.id !== started.id) return;
      if (!authenticated) {
        if (ref.current.token) {
          const next = { ...ref.current, token: null };
          ref.current = next;
          setSession(next);
        }
        setAccessError(
          started.access.blocked
            ? "Não foi possível confirmar seu acesso. Seus rascunhos continuam salvos. Confira suas credenciais com o professor ou a escola."
            : "O servidor está indisponível. Tentaremos sincronizar novamente automaticamente.",
        );
        return;
      }
      setAccessError("");
      if (ref.current.token !== authenticated.token) {
        const next = { ...ref.current, token: authenticated.token };
        ref.current = next;
        setSession(next);
        await update((data) => ({
          ...data,
          user: authenticated.user,
          authenticatedAt: Date.now(),
        }));
        if (ref.current?.id !== started.id) return;
        try {
          await refresh();
        } catch (error) {
          if (ref.current?.id === started.id) notice(message(error));
        }
      }
      if (ref.current?.id !== started.id) return;
      current = ref.current;
      for (const [key, draft] of Object.entries(current.data.drafts)) {
        if (ref.current?.id !== current.id) break;
        const operation = draft.pending;
        if (
          !operation ||
          draft.status !== "queued" ||
          (draft.retryAt || 0) > Date.now()
        )
          continue;
        try {
          const result = await api<{
            submission: Submission;
            replayed: boolean;
          }>("/sync/submissions", current.token, "POST", operation);
          if (ref.current?.id !== current.id) break;
          await update((data) => ({
            ...data,
            drafts: {
              ...data.drafts,
              [key]: applyReceipt(
                data.drafts[key]!,
                operation.operationId,
                result.submission,
              ),
            },
          }));
          notice(
            "Entrega sincronizada. Seu grupo já pode receber a devolutiva.",
          );
        } catch (error) {
          if (ref.current?.id !== current.id) break;
          if (error instanceof ApiError) {
            await update((data) => {
              const active = data.drafts[key]!;
              const transient =
                error.status === 401 ||
                error.status === 0 ||
                error.status === 429 ||
                error.status >= 500;
              const attempts = (active.attempts || 0) + 1;
              const conflict =
                error.code === "VERSION_CONFLICT"
                  ? (error.details as { current: Submission | null })?.current
                  : undefined;
              return {
                ...data,
                drafts: {
                  ...data.drafts,
                  [key]: {
                    ...active,
                    status:
                      error.code === "VERSION_CONFLICT"
                        ? "conflict"
                        : transient
                          ? "queued"
                          : "error",
                    conflict,
                    error: error.message,
                    attempts,
                    retryAt:
                      Date.now() +
                      Math.max(
                        error.retryAfter * 1000,
                        Math.min(60000, 2000 * 2 ** Math.min(attempts, 5)),
                      ) +
                      Math.random() * 1000,
                  },
                },
              };
            });
            if (error.status === 401) {
              current.access.invalidate(current.token);
              const live = ref.current;
              if (live?.id === current.id) {
                const next = { ...live, token: null };
                ref.current = next;
                setSession(next);
              }
            }
          } else
            notice(
              "Não foi possível atualizar o armazenamento local. Mantenha a tela aberta.",
            );
          break;
        }
      }
    } catch (error) {
      if (ref.current?.id === current?.id) notice(message(error));
    } finally {
      syncing.current = false;
    }
  }, [notice, update, refresh]);
  useEffect(() => {
    void sync();
    const interval = setInterval(() => void sync(), 5000);
    return () => clearInterval(interval);
  }, [sync, online, session?.id]);

  async function login(credentials: Credentials, prepare: boolean) {
    const local = prepare ? await Vault.open(credentials) : null;
    const access = new SessionAccess(credentials, local?.data?.user.id);
    const authenticated = navigator.onLine ? await access.ensure() : null;
    if (!authenticated && access.blocked) {
      access.close();
      throw access.failure;
    }
    if (!authenticated && !local?.data) {
      access.close();
      throw new Error(
        "O primeiro acesso precisa de conexão com o servidor. Não há conteúdo preparado para este perfil neste aparelho.",
      );
    }
    if (
      !authenticated &&
      Date.now() - local!.data!.authenticatedAt > 7 * 86400000
    ) {
      access.close();
      throw new Error(
        "Conecte-se para renovar o acesso offline, disponível por até 7 dias.",
      );
    }
    const user = authenticated?.user || local!.data!.user;
    const data: Workspace = local?.data || {
      user,
      authenticatedAt: Date.now(),
      classrooms: [],
      selectedClass: "",
      missions: [],
      groups: [],
      drafts: {},
      updatedAt: 0,
    };
    const next: Session = {
      id: crypto.randomUUID(),
      access,
      token: authenticated?.token || null,
      vault: local?.vault || null,
      data: {
        ...data,
        user,
        authenticatedAt: authenticated ? Date.now() : data.authenticatedAt,
      },
    };
    try {
      if (next.vault) {
        next.release = await next.vault.acquire();
        await next.vault.save(next.data);
      }
    } catch (error) {
      next.release?.();
      access.close();
      throw error;
    }
    ref.current = next;
    setSession(next);
    setStorageError("");
    setAccessError("");
    navigate("/");
    if (authenticated) {
      try {
        await refresh();
      } catch (error) {
        notice(message(error));
      }
    } else
      notice(
        "Conteúdo salvo aberto. As entregas na fila serão enviadas automaticamente quando a conexão voltar.",
      );
  }
  async function logout() {
    const current = ref.current;
    if (!current) return;
    try {
      await current.vault?.flush();
    } catch {
      notice(
        "Há falha ao salvar. Envie ou copie o trabalho antes de encerrar.",
      );
      return;
    }
    current.access.close();
    current.release?.();
    ref.current = null;
    setSession(null);
    setLeave(false);
    setToast("");
    setAccessError("");
    navigate("/");
  }
  if (!session) return <Login onLogin={login} />;
  const teacher = session.data.user.role === "teacher";
  const pending =
    Object.values(session.data.drafts).filter(hasWork).length +
    (session.data.planning ? 1 : 0);
  const links = teacher
    ? [
        { path: "/", label: "Visão da turma", icon: LayoutDashboard },
        { path: "/missions", label: "Missões", icon: Compass },
        { path: "/planning", label: "Planejamento", icon: Sparkles },
        { path: "/groups", label: "Turma e grupos", icon: Users },
      ]
    : [
        { path: "/", label: "Minhas missões", icon: Compass },
        { path: "/avatar", label: "Meu avatar", icon: Sparkles },
        { path: "/team", label: "Minha equipe", icon: Users },
      ];
  const connection = online && session.token;
  return (
    <AppContext.Provider
      value={{
        data: session.data,
        token: session.token,
        online: !!connection,
        saving,
        storageError,
        persistent: !!session.vault,
        update,
        refresh,
        sync,
        notice,
        navigate,
      }}
    >
      <div
        className="app-shell"
        data-eco={session.data.avatar?.ecoMode !== false}
      >
        <aside className="sidebar">
          <Brand />
          <div className="space-label">
            {teacher ? "ESPAÇO DO EDUCADOR" : "SUA JORNADA"}
          </div>
          <nav aria-label="Navegação principal">
            {links.map((link) => (
              <a
                key={link.path}
                href={`#${link.path}`}
                aria-current={path === link.path ? "page" : undefined}
              >
                <link.icon size={20} />
                {link.label}
                {link.path === "/missions" && (
                  <span className="nav-count">
                    {session.data.missions.length}
                  </span>
                )}
              </a>
            ))}
          </nav>
          <div className="sidebar-note">
            <ShieldCheck size={22} />
            <strong>Aprender no seu ritmo</strong>
            <p>Aqui, cada contribuição conta. Na tela, no papel e em equipe.</p>
          </div>
          <div className="sidebar-footer">
            <span className="initial-avatar">
              {session.data.user.name.charAt(0)}
            </span>
            <div>
              <strong>{session.data.user.name}</strong>
              <small>{teacher ? "Professor" : "Estudante"}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sair ou trocar perfil"
              onClick={() => setLeave(true)}
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>
        <div className="app-main">
          <header className="topbar">
            <div className="mobile-brand">
              <Brand />
            </div>
            <div className="breadcrumb">
              Seu espaço <span>/</span>{" "}
              <strong>
                {teacher ? "Mediação e descobertas" : "Aprendizagem em equipe"}
              </strong>
            </div>
            <div className="topbar-actions">
              <Badge tone={connection ? "success" : "warning"}>
                {connection ? <Wifi size={14} /> : <CloudOff size={14} />}
                {connection ? "Conectado" : "Acesso local"}
              </Badge>
              {!teacher && (
                <Badge tone="xp">
                  <Sparkles size={15} />
                  {session.data.avatar?.xp || 0} XP
                </Badge>
              )}
              <button
                className="icon-button mobile-exit"
                aria-label="Sair ou trocar perfil"
                onClick={() => setLeave(true)}
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>
          <main className="content" id="main-content">
            <div className="workspace-toolbar">
              <label className="class-selector">
                <GraduationCap size={17} />
                <span className="sr-only">Turma selecionada</span>
                <select
                  aria-label="Turma selecionada"
                  value={session.data.selectedClass}
                  disabled={!connection}
                  onChange={(e) =>
                    void refresh(e.target.value)
                      .then(() => navigate("/"))
                      .catch((e) => notice(message(e)))
                  }
                >
                  {!session.data.classrooms.length && (
                    <option value="">Nenhuma turma</option>
                  )}
                  {session.data.classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button text-button"
                disabled={!connection}
                onClick={() =>
                  void refresh()
                    .then(sync)
                    .then(() => notice("Seu espaço foi atualizado."))
                    .catch((e) => notice(message(e)))
                }
              >
                <RefreshCw size={15} /> Atualizar
              </button>
            </div>
            {!connection && (
              <div className="alert">
                <CloudOff size={18} />
                <span>
                  Continue com suas missões salvas. As entregas na fila serão
                  enviadas automaticamente quando houver conexão com o servidor.
                </span>
              </div>
            )}
            {!session.vault && (
              <div className="alert warning">
                Acesso temporário: os rascunhos serão perdidos ao fechar a
                página. Envie antes de sair.
              </div>
            )}
            <ErrorText error={storageError} />
            <ErrorText error={accessError} />
            {needRefresh && (
              <div className="alert">
                <Download size={18} />
                <span>Uma nova versão está disponível.</span>
                <button
                  disabled={saving || pending > 0 || !!session.data.planning}
                  onClick={() => void updateServiceWorker(true)}
                >
                  Atualizar aplicativo
                </button>
                {(pending > 0 || !!session.data.planning) && (
                  <small>
                    Conclua ou guarde os rascunhos antes de atualizar.
                  </small>
                )}
              </div>
            )}
            <Suspense
              fallback={
                <div className="loading" role="status">
                  Abrindo seu espaço…
                </div>
              }
            >
              {teacher ? <Teacher path={path} /> : <Student path={path} />}
            </Suspense>
            <footer className="content-footer">
              <span>
                <ShieldCheck size={14} /> Seu aprendizado, sua autonomia.
              </span>
              {install ? (
                <button
                  className="button text-button"
                  onClick={() =>
                    void install
                      .prompt()
                      .then(() => install.userChoice)
                      .then(() => setInstall(null))
                  }
                >
                  <Download size={15} /> Instalar EducaXP
                </button>
              ) : (
                <span>
                  {offlineReady
                    ? "Aplicativo preparado para abrir offline"
                    : "EducaXP · Feito para aprender juntos"}
                </span>
              )}
            </footer>
          </main>
        </div>
        <nav className="bottom-nav" aria-label="Navegação no celular">
          {links.map((link) => (
            <a
              key={link.path}
              href={`#${link.path}`}
              aria-current={path === link.path ? "page" : undefined}
            >
              <link.icon size={21} />
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={18} />
            <span>{toast}</span>
            <button aria-label="Fechar mensagem" onClick={() => setToast("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {leave && (
          <Modal title="Encerrar este acesso?" close={() => setLeave(false)}>
            <p>
              {pending
                ? `${pending} atividade(s) ainda têm trabalho local. ${session.vault ? "Os dados ficam protegidos neste aparelho e poderão ser abertos com suas credenciais." : "Copie ou envie o trabalho antes de sair; este acesso é temporário."}`
                : "A próxima pessoa deverá entrar com as próprias credenciais."}
            </p>
            <button
              className="button primary"
              disabled={
                saving || !!storageError || (!session.vault && pending > 0)
              }
              onClick={() => void logout()}
            >
              {pending ? "Guardar e encerrar acesso" : "Encerrar acesso"}
            </button>
          </Modal>
        )}
      </div>
    </AppContext.Provider>
  );
}
