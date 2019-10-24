import { TelloEmulator, AccessMode, STAT_PORT, COMMAND_PORT, VIDEO_PORT } from "../emus/TelloEmulator";
import log4js from "log4js";
import tu from "./TestUtils";
import * as dgram from 'dgram';
import * as fs from 'fs';


const logger = log4js.getLogger();

describe('Tello Emulator Test', function () {
  const HOST_NAIN_IP = "192.168.11.3";
  const TELLO_ADDRESS = "192.168.11.10"; // このホストで使えるテスト用のIPアドレス
  let tello: TelloEmulator;

  beforeAll(() => {
    tello = new TelloEmulator(AccessMode.AccessPoint, TELLO_ADDRESS);
    log4js.configure("./configs/log4js_config.json");
  });
  it("constructor test", async function () {
    await tu.delayAsync(300);
    expect(tello.address).toBe(TELLO_ADDRESS);
  });
  it("send command test", async () => {
    await sendCommandTest(tello.address);
  });
  it("receive stat test", async () => {
    await ReceiveStatTest("127.0.0.1");
  });

  afterAll(() => {
    tello.dispose();
  })

});

describe.only('Real Tello Test', function () {
  const AP = false;
  const TELLO_ADDRESS = AP ? "192.168.20.106" : "192.168.10.1";
  beforeAll(() => {
    log4js.configure("./configs/log4js_config.json");
  });
  it("send command test", async () => {
    await sendCommandTest(TELLO_ADDRESS);
  });
  it("receive stat test", async () => {
    await ReceiveStatTest(TELLO_ADDRESS);
  });
  it("video stream test", async () => {
    await VideoStreamTest(TELLO_ADDRESS);

  });
  it.skip("send ap settings", async () => {
    const sk = dgram.createSocket("udp4");
    try {
      const local_port = 12345;
      const cbSend = jest.fn(err => {
        expect(err).toBeNull();
      });
      const cbMsg = jest.fn((msg, info) => {
        expect(info.port).toBe(COMMAND_PORT);
        expect(info.address).toBe(TELLO_ADDRESS);
        logger.info(msg.toString());
      });
      sk.bind(local_port);
      sk.on("message", cbMsg);
      await tu.delayAsync(100);
      sk.send("ap pi4-ap raspberry", COMMAND_PORT, TELLO_ADDRESS, cbSend);
      await tu.delayAsync(1000);
      expect(cbSend).toBeCalled();
    } finally {
      sk.close();
    }
  });
});

async function sendCommandTest(telloIpAddress: string): Promise<void> {
  const sk = dgram.createSocket("udp4");
  try {
    const local_port = 12345;
    const cbSend = jest.fn(err => {
      expect(err).toBeNull();
    });
    const cbMsg = jest.fn((msg, info) => {
      expect(info.port).toBe(COMMAND_PORT);
      expect(info.address).toBe(telloIpAddress);
      const str = msg.toString();
      if (str == "ok") {
        logger.info("command -> ok");
      } else {
        fs.writeFile("./logs/commandresp.bin", msg, err => {
          if (err) {
            logger.error(err);
          }
        });
        logger.warn("command -> unknown data");
      }
    });
    sk.bind(local_port);
    sk.on("message", cbMsg);
    await tu.delayAsync(100);
    sk.send("command", COMMAND_PORT, telloIpAddress, cbSend);
    await tu.delayAsync(100);
    expect(cbSend).toBeCalled();
  } finally {
    sk.close();
  }
}

async function ReceiveStatTest(telloIpAddress: string): Promise<void> {
  const sk = dgram.createSocket("udp4");
  try {
    const cbListening = jest.fn();
    const cbMessage = jest.fn((msg, info) => {
      expect(info.address).toBe(telloIpAddress);
      expect(info.port).toBe(COMMAND_PORT);
      expect(msg.toString()).toMatch(/^mid:-1;x:0;y:0;z:0;/);
    });
    sk.bind(STAT_PORT);
    sk.on("listening", cbListening);
    sk.on("message", cbMessage);
    await tu.delayAsync(1000);
    expect(cbListening).toBeCalled();
    expect(cbMessage).toBeCalled();
  } finally {
    sk.close();
  }
}

async function VideoStreamTest(telloIpAddress: string): Promise<void> {
  const cmdSock = dgram.createSocket("udp4");
  const videoSock = dgram.createSocket("udp4");
  try {
    const local_port = 12345;
    const cbSend = jest.fn(err => {
      expect(err).toBeNull();
    });
    const cbMsg = jest.fn((msg, info) => {
      expect(info.port).toBe(COMMAND_PORT);
      expect(info.address).toBe(telloIpAddress);
      const str = msg.toString();
      if (str == "ok") {
        logger.info("streamon -> ok");
        
      }
    });
    const cbVideo = jest.fn((msg, info) => {
      
    });

    cmdSock.bind(local_port);
    cmdSock.on("message", cbMsg);

    videoSock.bind(VIDEO_PORT);

    

    await tu.delayAsync(100);
    const t = new Promise((resolve, reject) => {
      videoSock.on("message", (msg, info) => {
        logger.info("video stream received");
        resolve();
      });
      setTimeout(() => {
        reject();
      }, 5000);
    });
    cmdSock.send("streamon", COMMAND_PORT, telloIpAddress, cbSend);
    await t;
    cmdSock.send("streamoff", COMMAND_PORT, telloIpAddress, () => { });
    await tu.delayAsync(100);
    
    expect(cbSend).toBeCalled();
    //expect(cbVideo).toBeCalled();
  } finally {
    cmdSock.close();
    videoSock.close();
  }
}