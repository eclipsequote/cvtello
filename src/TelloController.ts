import http from "http";
import dgram from "dgram";
import child_process from "child_process";
import Queue from "./Queue";

class TelloCommand {
  Command: string;
}

const COMMAND_PORT = 8889;
const STAT_PORT = 8890;
const VIDEP_PORT = 11111;
export class TelloAgent {

  isConnecting = false;
  cmdQueue = new Queue<TelloCommand>();
  address:string;

  constructor() {

  }
}