import * as dgram from 'dgram';
import * as fs from 'fs';
import log4js from "log4js";
import { AddressInfo } from 'net';


export enum AccessMode {
  Client,
  AccessPoint,
}

const APMODE_ADDRESS = "192.168.10.1";
const BROADCAST_ADDRESS = "";
const STAT_INTERVAL = 100;
export const COMMAND_PORT = 8889;
export const STAT_PORT = 8890;
export const VIDEO_PORT = 11111;

export class TelloEmulator {
  logger: log4js.Logger;
  address: string;
  accessMode: AccessMode;
  commandSocket: dgram.Socket;
  statSocket: dgram.Socket;
  videoSocket: dgram.Socket;
  isAlive = true;
  statTimeoutId: NodeJS.Timeout | null;
  stat: TelloStat;
  isInSdkMode: boolean;
  statInterval: number;

  constructor(accessMode: AccessMode, address: string | undefined = undefined, statInterval = STAT_INTERVAL) {
    this.logger = log4js.getLogger("emulator");

    this.accessMode = accessMode;
    if (address) {
      this.address = address;
    } else if (accessMode == AccessMode.AccessPoint) {
      this.address = APMODE_ADDRESS;
    } else {
      this.address = "127.0.0.1";
    }

    this.commandSocket = dgram.createSocket('udp4');
    this.commandSocket.bind(COMMAND_PORT, this.address);
    this.statSocket = dgram.createSocket('udp4');
    this.statSocket.bind(COMMAND_PORT);
    this.videoSocket = dgram.createSocket('udp4');
    this.stat = new TelloStat();
    this.isInSdkMode = false;

    this.commandSocket.on("message", (msg, info) => {
      this.onReceiveCommand(msg.toString(), info);
    });
    this.statTimeoutId = null;
    this.statInterval = statInterval;
  }


  private sendCommandResponse(msg: string, senderInfo: AddressInfo) {
    const buf = Buffer.from(msg);
    this.commandSocket.send(buf, 0, buf.length, senderInfo.port, senderInfo.address, (err) => {
      if (err) {
        this.logger.error(err);
      }
    })
  }

  private onReceiveCommand(msg: string, info: AddressInfo): void {
    const params = msg.split(' ');
    switch (params[0]) {
      case "command":
        if (!this.isInSdkMode) {
          this.isInSdkMode = true;
          this.startStat();
        }
        this.sendCommandResponse("ok", info);        
        break;
    }
  }

  private startStat(): void {
    if (this.statTimeoutId != null) return;

    this.statTimeoutId = setInterval(() => {
      if (this.isAlive) {
        this.sendStat();
      } else {
        this.stopStat();
      }
    }, this.statInterval);
  }

  private stopStat(): void {
    if (this.statTimeoutId == null) return;
    clearInterval(this.statTimeoutId);
    this.statTimeoutId = null;
  }

  private sendStat(): void {
    const msg = Buffer.from(this.stat.toString());
    this.statSocket.send(msg, STAT_PORT, BROADCAST_ADDRESS, (err) => {
      if (err) {
        this.logger.error(err);
      }
    });
  }


  dispose(): void {
    this.isAlive = false;
    this.stopStat();

    this.commandSocket.close();
    this.statSocket.close();
    this.videoSocket.close();
  }
}

class TelloStat {
  mid: number;
  x: number;
  y: number;
  z: number;
  mpry: string;
  pitch: number;
  roll: number;
  yaw: number;
  vgx: number;
  vgy: number;
  vgz: number;
  templ: number;
  temph: number;
  tof: number;
  h: number;
  bat: number;
  baro: number;
  time: number;
  agx: number;
  agy: number;
  agz: number;

  constructor() {
    this.mid = -1;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.mpry = "0,0,0";
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    this.vgx = 0; // speed
    this.vgy = 0;
    this.vgz = 0;
    this.templ = 25; // the lowest temperature
    this.temph = 30; // the highest temperature
    this.tof = 0; // the time of flight distance in cm
    this.h = 0; // the height in cm
    this.bat = 100; // the percentage of the curent battery level
    this.baro = 0; // the barometer measurement in cm
    this.time = 0; // the amount of time the motor has benn used
    this.agx = 0; // acceleration
    this.agy = 0;
    this.agz = 0;
  }

  toString() {
    return `mid:${this.mid};x:${this.x};y:${this.y};z:${this.z};mpry:${this.mpry};pitch:${this.pitch};roll:${this.roll};yaw:${this.yaw};vgx:${this.vgx};vgy:${this.vgy};vgz:${this.vgz};templ:${this.templ};temph:${this.temph};tof:${this.tof};h:${this.h};bat:${this.bat};baro:${this.baro};time:${this.time};agx:${this.agx};agy:${this.agy};agz:${this.agz};`;
  }
}