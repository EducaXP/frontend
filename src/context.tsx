import { createContext, useContext } from "react";
import type { Workspace } from "./types";
export interface AppContextValue {
  data: Workspace;
  token: string | null;
  online: boolean;
  saving: boolean;
  storageError: string;
  persistent: boolean;
  update: (fn: (value: Workspace) => Workspace) => Promise<void>;
  refresh: (classId?: string) => Promise<void>;
  sync: () => Promise<void>;
  notice: (message: string) => void;
  navigate: (path: string) => void;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Sessão indisponível");
  return value;
}
