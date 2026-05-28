export const byteAt = (buffer: ByteBuffer, byteIndex: number): number => {
  const byte = buffer[byteIndex];
  if (byte === undefined) {
    throw new Error(`unexpected end of buffer at byte ${byteIndex}`);
  }
  return byte;
};
