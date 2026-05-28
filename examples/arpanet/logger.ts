import pino from "pino";

const wrapPino = (instance: pino.Logger): Logger => ({
  debug(msg: string) { instance.debug(msg); },
  info(msg: string) { instance.info(msg); },
  warn(msg: string) { instance.warn(msg); },
  error(msg: string) { instance.error(msg); },
  child(scope: string) { return wrapPino(instance.child({ scope })); },
});

export const createLogger = (name: string): Logger => wrapPino(pino({ name }));
