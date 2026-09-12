import type { Credentials } from "./types";
import { SessionAccess } from "./session-access";
import { Vault } from "./vault";

export async function prepareAccess(
  credentials: Credentials,
  prepare: boolean,
  online: boolean,
) {
  const access = new SessionAccess(credentials);
  try {
    // A stale local encryption key must not veto credentials accepted by the server.
    const authenticated = online ? await access.ensure() : null;
    if (!authenticated && access.blocked) throw access.failure;
    const local = prepare
      ? await Vault.open(credentials, authenticated?.user)
      : null;
    if (!authenticated && !local?.data)
      throw new Error(
        "O primeiro acesso precisa de conexão com o servidor. Não há conteúdo preparado para este perfil neste aparelho.",
      );
    if (
      !authenticated &&
      Date.now() - local!.data!.authenticatedAt > 7 * 86400000
    )
      throw new Error(
        "Conecte-se para renovar o acesso offline, disponível por até 7 dias.",
      );
    const user = authenticated?.user || local!.data!.user;
    // Offline reconnection is pinned to the owner of the unlocked workspace.
    access.bindUser(user.id);
    return { access, authenticated, local, user };
  } catch (error) {
    access.close();
    throw error;
  }
}
