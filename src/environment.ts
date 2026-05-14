import {
  NEW_ENVIRON_ESC,
  NEW_ENVIRON_INFO,
  NEW_ENVIRON_IS,
  NEW_ENVIRON_USERVAR,
  NEW_ENVIRON_VALUE,
  NEW_ENVIRON_VAR,
} from "./constants";
import { asciiByte } from "./utils/ascii-byte";
import { byteAt } from "./utils/byte-at";

const isEnvironmentOptionMarker = (byte: number): boolean => {
  return byte === NEW_ENVIRON_VAR || byte === NEW_ENVIRON_USERVAR;
};

const parseEscapedAscii = (buffer: ByteBuffer, byteIndex: number): [string, number] => {
  if (byteAt(buffer, byteIndex) === NEW_ENVIRON_ESC) {
    return [asciiByte(buffer, byteIndex + 1), byteIndex + 2];
  }
  return [asciiByte(buffer, byteIndex), byteIndex + 1];
};

export const parseEnvironment = (telnet: EnvironmentTarget, buffer: ByteBuffer): void => {
  const qualifier = byteAt(buffer, 0);
  if (qualifier !== NEW_ENVIRON_IS && qualifier !== NEW_ENVIRON_INFO) {
    throw new Error(`env parse: expected IS or INFO, got ${qualifier}`);
  }

  const changedEnvironment: Environment = {};
  let byteIndex = 1;

  while (byteIndex < buffer.length) {
    const variableType = byteAt(buffer, byteIndex);
    if (!isEnvironmentOptionMarker(variableType)) {
      byteIndex += 1;
      continue;
    }

    byteIndex += 1;
    let variableName = "";
    let variableValue: string | null = null;

    while (
      byteIndex < buffer.length &&
      byteAt(buffer, byteIndex) !== NEW_ENVIRON_VALUE &&
      !isEnvironmentOptionMarker(byteAt(buffer, byteIndex))
    ) {
      const [character, nextByteIndex] = parseEscapedAscii(buffer, byteIndex);
      variableName += character;
      byteIndex = nextByteIndex;
    }

    if (byteIndex < buffer.length && byteAt(buffer, byteIndex) === NEW_ENVIRON_VALUE) {
      byteIndex += 1;
      variableValue = "";

      while (byteIndex < buffer.length && !isEnvironmentOptionMarker(byteAt(buffer, byteIndex))) {
        const [character, nextByteIndex] = parseEscapedAscii(buffer, byteIndex);
        variableValue += character;
        byteIndex = nextByteIndex;
      }
    }

    telnet.env[variableName] = variableValue;
    changedEnvironment[variableName] = variableValue;
  }

  telnet.emit("environment", changedEnvironment);
};
