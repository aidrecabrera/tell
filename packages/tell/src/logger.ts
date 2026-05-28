export const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() { return noopLogger; },
};
