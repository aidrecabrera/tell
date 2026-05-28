export const asciiByte = (buffer: ByteBuffer, byteIndex: number): string => {
  return buffer.toString("ascii", byteIndex, byteIndex + 1);
};
