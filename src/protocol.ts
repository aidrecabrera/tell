import {
  TELNET_ABORT,
  TELNET_AO,
  TELNET_AYT,
  TELNET_BREAK,
  TELNET_DM,
  TELNET_DO,
  TELNET_DONT,
  TELNET_EC,
  TELNET_EL,
  TELNET_EOF,
  TELNET_EOR,
  TELNET_GA,
  TELNET_IAC,
  TELNET_IP,
  TELNET_NOP,
  TELNET_OPT_BINARY,
  TELNET_OPT_COMPRESS2,
  TELNET_OPT_ECHO,
  TELNET_OPT_LINE_MODE,
  TELNET_OPT_NEW_ENVIRON,
  TELNET_OPT_STATUS,
  TELNET_OPT_SUPPRESS_GO_AHEAD,
  TELNET_OPT_TIMING_MARK,
  TELNET_OPT_TTYPE,
  TELNET_OPT_WINDOW_SIZE,
  TELNET_SB,
  TELNET_SE,
  TELNET_SUSP,
  TELNET_SYNCH,
  TELNET_TELQUAL_IS,
  TELNET_TELQUAL_SEND,
  TELNET_WILL,
  TELNET_WONT,
} from "./constants";

export const Commands = {
  IAC: TELNET_IAC,
  DONT: TELNET_DONT,
  DO: TELNET_DO,
  WONT: TELNET_WONT,
  WILL: TELNET_WILL,
  SB: TELNET_SB,
  GA: TELNET_GA,
  EL: TELNET_EL,
  EC: TELNET_EC,
  AYT: TELNET_AYT,
  AO: TELNET_AO,
  IP: TELNET_IP,
  BREAK: TELNET_BREAK,
  DM: TELNET_DM,
  NOP: TELNET_NOP,
  SE: TELNET_SE,
  EOR: TELNET_EOR,
  ABORT: TELNET_ABORT,
  SUSP: TELNET_SUSP,
  EOF: TELNET_EOF,
  SYNCH: TELNET_SYNCH,
};

export const Options = {
  OPT_BINARY: TELNET_OPT_BINARY,
  OPT_ECHO: TELNET_OPT_ECHO,
  OPT_SUPPRESS_GO_AHEAD: TELNET_OPT_SUPPRESS_GO_AHEAD,
  OPT_STATUS: TELNET_OPT_STATUS,
  OPT_TIMING_MARK: TELNET_OPT_TIMING_MARK,
  OPT_TTYPE: TELNET_OPT_TTYPE,
  OPT_WINDOW_SIZE: TELNET_OPT_WINDOW_SIZE,
  OPT_LINE_MODE: TELNET_OPT_LINE_MODE,
  OPT_NEW_ENVIRON: TELNET_OPT_NEW_ENVIRON,
  OPT_COMPRESS2: TELNET_OPT_COMPRESS2,
  TELQUAL_IS: TELNET_TELQUAL_IS,
  TELQUAL_SEND: TELNET_TELQUAL_SEND,
};

export const IAC = Commands.IAC;
export const DONT = Commands.DONT;
export const DO = Commands.DO;
export const WONT = Commands.WONT;
export const WILL = Commands.WILL;
export const SB = Commands.SB;
export const GA = Commands.GA;
export const EL = Commands.EL;
export const EC = Commands.EC;
export const AYT = Commands.AYT;
export const AO = Commands.AO;
export const IP = Commands.IP;
export const BREAK = Commands.BREAK;
export const DM = Commands.DM;
export const NOP = Commands.NOP;
export const SE = Commands.SE;
export const EOR = Commands.EOR;
export const ABORT = Commands.ABORT;
export const SUSP = Commands.SUSP;
export const EOF = Commands.EOF;
export const SYNCH = Commands.SYNCH;

export const OPT_BINARY = Options.OPT_BINARY;
export const OPT_ECHO = Options.OPT_ECHO;
export const OPT_SUPPRESS_GO_AHEAD = Options.OPT_SUPPRESS_GO_AHEAD;
export const OPT_STATUS = Options.OPT_STATUS;
export const OPT_TIMING_MARK = Options.OPT_TIMING_MARK;
export const OPT_TTYPE = Options.OPT_TTYPE;
export const OPT_WINDOW_SIZE = Options.OPT_WINDOW_SIZE;
export const OPT_LINE_MODE = Options.OPT_LINE_MODE;
export const OPT_NEW_ENVIRON = Options.OPT_NEW_ENVIRON;
export const OPT_COMPRESS2 = Options.OPT_COMPRESS2;
export const TELQUAL_IS = Options.TELQUAL_IS;
export const TELQUAL_SEND = Options.TELQUAL_SEND;
