import { Commands } from "../protocol";
import { byteAt } from "./byte-at";

export const unquoteIac = (payload: ByteBuffer): ByteBuffer => {
  const unquoted = Buffer.alloc(payload.length);
  let destinationIndex = 0;

  for (let sourceIndex = 0; sourceIndex < payload.length; sourceIndex += 1) {
    unquoted[destinationIndex] = byteAt(payload, sourceIndex);
    destinationIndex += 1;

    if (
      payload[sourceIndex] === Commands.IAC &&
      sourceIndex + 1 < payload.length &&
      payload[sourceIndex + 1] === Commands.IAC
    ) {
      sourceIndex += 1;
    }
  }

  return unquoted.subarray(0, destinationIndex);
};
