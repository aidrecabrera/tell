import pino from "pino";

export const createLogger = (name: string): Logger => {
  const pinoInstance = pino({ name });
  return wrapPino(pinoInstance);
};

const wrapPino = (instance: pino.Logger): Logger => ({
  debug(msg: string) { instance.debug(msg); },
  info(msg: string) { instance.info(msg); },
  warn(msg: string) { instance.warn(msg); },
  error(msg: string) { instance.error(msg); },
  child(scope: string) { return wrapPino(instance.child({ scope })); },
});
