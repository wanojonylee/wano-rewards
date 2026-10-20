import type { Role, UserRow } from "./types.ts";

declare global {
  namespace Express {
    interface Request {
      /** Correlation id, echoed in error payloads and access logs. */
      id: string;
      auth?: {
        userId: string;
        role: Role;
        user: UserRow;
      };
    }
  }
}

export {};
