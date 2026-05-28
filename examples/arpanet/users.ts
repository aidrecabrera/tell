export interface SessionInfo {
  id: string;
  username: string;
  loginTime: Date;
  term: string | undefined;
  windowSize: [number, number] | undefined;
  remoteAddress: string;
  deliver: (message: string) => void;
}

const CREDENTIALS: Record<string, string> = {
  admin: "admin",
  guest: "guest",
};

const sessions = new Map<string, SessionInfo>();

export const authenticate = (username: string, password: string): boolean => {
  return CREDENTIALS[username] === password;
};

export const register = (info: SessionInfo): void => {
  sessions.set(info.id, info);
};

export const unregister = (id: string): void => {
  sessions.delete(id);
};

export const getConnected = (): SessionInfo[] => {
  return Array.from(sessions.values());
};

export const findByUsername = (username: string): SessionInfo | undefined => {
  return Array.from(sessions.values()).find((session) => session.username === username);
};
