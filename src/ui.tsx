import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CloudOff,
  Layers3,
  Sparkles,
} from "lucide-react";
export function Brand() {
  return (
    <a className="brand" href="#/" aria-label="EducaXP, início">
      <img src="/assets/educaxp-emblem.png" alt="" />
      <span>
        Educa<span>XP</span>
        <small>APRENDER EM EQUIPE</small>
      </span>
    </a>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Layers3 size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function PageTitle({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{label}</span>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <div className="alert danger" role="alert">
      {error}
    </div>
  ) : null;
}
export function OfflineNote() {
  return (
    <div className="alert">
      <CloudOff size={18} />
      <span>
        Você está usando o conteúdo salvo. Conecte-se para buscar novidades ou
        enviar alterações.
      </span>
    </div>
  );
}
export function MissionArt({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`mission-art ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <div className="art-card art-left">
        <BookOpen size={38} />
        <i />
        <i />
      </div>
      <div className="art-card art-right">
        <Check size={26} />
        <i />
        <i />
      </div>
      <div className="art-star">
        <Sparkles size={52} strokeWidth={1.5} />
      </div>
      <span className="art-dot dot-one" />
      <span className="art-dot dot-two" />
      <span className="art-caption">
        IDEIAS QUE SE ENCONTRAM <ArrowUpRight size={15} />
      </span>
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <h2>{title}</h2>
      {children}
      <button className="button ghost" onClick={close}>
        Voltar
      </button>
    </dialog>
  );
}
