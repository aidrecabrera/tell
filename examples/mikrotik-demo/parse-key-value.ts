export const parseKeyValue = (args: string[]): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const arg of args) {
    const separatorIndex = arg.indexOf("=");
    if (separatorIndex > 0) {
      result[arg.slice(0, separatorIndex)] = arg.slice(separatorIndex + 1);
    }
  }
  return result;
};
