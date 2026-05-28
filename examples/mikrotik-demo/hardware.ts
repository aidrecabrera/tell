import os from "node:os";

export const getUptime = (): string => {
  const totalSeconds = os.uptime();
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, `${seconds}s`]
    .filter(Boolean)
    .join("");
};

export const formatMiB = (bytes: number): string => {
  return (bytes / 1048576).toFixed(1);
};

export const getCpuModel = (): string => {
  return os.cpus()[0]?.model ?? "unknown";
};

export const getCpuCount = (): number => {
  return os.cpus().length;
};

export interface NetworkEntry {
  name: string;
  ip: string;
  netmask: string;
  family: string;
  cidr: string | null;
}

export const getNetworkInterfaces = (): NetworkEntry[] => {
  const interfaces = os.networkInterfaces();
  return Object.entries(interfaces).flatMap(([name, addresses]) =>
    (addresses ?? []).map((address) => ({
      name,
      ip: address.address,
      netmask: address.netmask,
      family: address.family,
      cidr: address.cidr,
    }))
  );
};

export const getNetworkAddress = (ipAddress: string, netmask: string): string => {
  const ipOctets = ipAddress.split(".");
  const maskOctets = netmask.split(".");
  if (ipOctets.length !== 4 || maskOctets.length !== 4) return ipAddress;

  return ipOctets
    .map((octet, octetIndex) => parseInt(octet, 10) & parseInt(maskOctets[octetIndex] ?? "0", 10))
    .join(".");
};

export const getPrefixLength = (netmask: string): number => {
  return netmask
    .split(".")
    .reduce((bitCount, octet) => {
      let byteValue = parseInt(octet, 10);
      while (byteValue > 0) {
        bitCount += byteValue & 1;
        byteValue >>= 1;
      }
      return bitCount;
    }, 0);
};
