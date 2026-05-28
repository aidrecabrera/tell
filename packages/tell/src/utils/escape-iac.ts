import { Commands } from "../protocol";

export const escapeIac = (data: ByteBuffer): ByteBuffer => {
  const iacCount = data.reduce((count, byte) => {
    if (byte === Commands.IAC) {
      return count + 1;
    }
    return count;
  }, 0);

  if (iacCount === 0) {
    return data;
  }

  const escaped = Buffer.alloc(data.length + iacCount);
  let destinationIndex = 0;
  for (const byte of data) {
    escaped[destinationIndex] = byte;
    destinationIndex += 1;
    if (byte === Commands.IAC) {
      escaped[destinationIndex] = Commands.IAC;
      destinationIndex += 1;
    }
  }
  return escaped;
};
