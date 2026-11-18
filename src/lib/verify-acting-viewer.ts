import * as z from "zod";
import { getForgejoViewer } from "./fgj-auth.js";

const ActingUser = z.object({ user: z.object({ login: z.string() }).nullish() });

export function verifyActingViewer(response: unknown, write: string): void {
  const login = ActingUser.safeParse(response).data?.user?.login;
  if (login === undefined) {
    return;
  }
  const viewer = getForgejoViewer();
  if (login !== viewer) {
    throw new Error(
      `Error: ${write} landed as '${login}', but fgj auth user names '${viewer}'; make fgj store the token's own login before acting again`,
    );
  }
}
