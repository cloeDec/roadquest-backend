import jwt from "jsonwebtoken";

const blacklist: Map<string, number> = new Map();

const CLEANUP_INTERVAL = 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of blacklist.entries()) {
    if (expiresAt < now) {
      blacklist.delete(token);
    }
  }
}, CLEANUP_INTERVAL);

export const revokeToken = (token: string): void => {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded || !decoded.exp) return;

  const expiresAt = decoded.exp * 1000;
  if (expiresAt <= Date.now()) return;

  blacklist.set(token, expiresAt);
};

export const isTokenRevoked = (token: string): boolean => {
  return blacklist.has(token);
};
