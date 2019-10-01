const http = require('http');
const dgram = require('dgram');
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const cv = require("opencv4nodejs");

const osdData = {};
const CMD_PORT = 8889;
const STAT_PORT = 8890;
const HTTP_PORT = 8001;
const VIDEO_PORT = 11111;
//const TELLO_IP = '192.168.10.1';
const TELLO_IP = '127.0.0.1';
//const HOST_IP = '192.168.10.3';
const HOST_IP = '127.0.0.1';
const WILD_IP = '0.0.0.0';
const CAPTURE_METHOD = "CV"; // CV or FFPLAY or None
const HEARTBEAT_INTERVAL = 5000;
const localPort = 50602;

const blockCmd = ['emergency', 'rc']  // blockng instruction
const notBlockCmd = ['reset_all']     // non-blocking instruction

const sockCmd = dgram.createSocket('udp4');
sockCmd.bind(localPort, HOST_IP);
const sockStat = dgram.createSocket('udp4');

const FFPLAY_PATH = "./bin/ffmpeg-4.2-win64-static/bin/ffplay.exe"
const FFPLAY_OPTIONS = ["-i", `udp://${TELLO_IP}:${VIDEO_PORT}`];
let ffplayProcess = null;

// array of commands
let order = [];
// lock for cmd
let lock = false;
let wCap = null;

let heartbeatId = null;

function sendMethod(cmd) {
	const message = Buffer.from(cmd);
	console.log('send:', cmd)
	sockCmd.send(message, 0, message.length, CMD_PORT, TELLO_IP, function (err, bytes) {
		if (err) {
			console.log('connection error', err);
			throw err;
		}
	});
}
function carryCMD() {
	lock = true
	if (order.length) {
		let cmd = order[0]
		console.log('[lhp_debug]carryCMD: %s\n', cmd);
		sendMethod(cmd)
	} else {
		console.log('[lhp_debug]carryCMD_else\n');
		lock = false
	}
}
function sendCmd(cmd) {
	if (notBlockCmd.indexOf(cmd) >= 0) {
		return
	}
	if (blockCmd.indexOf(cmd) >= 0) {
		sendMethod(cmd);
		order = [];
		return false;
	}

	order.push(cmd);
	!lock && carryCMD(); // cmd lock
};


sockCmd.on('message', function (msg, info) {
	//console.log('[lhp_debug]client.on\n');
	if (msg.toString() === 'ok') {
		console.log('Data received from server : ' + msg.toString());
		console.log('Received %d bytes from %s:%d\n', msg.length, info.address, info.port);
		if (order.length) {
			order = order.splice(1);
		}
		carryCMD();
		return
	}
	else {
		// if msg is not ok, empty the order
		console.log('not ok %s', msg.toString());
		order = [];
		lock = false;
	}
});

// receive response
function listenState() {
	let count = 0;
	sockStat.on('message', (msg, info) => {
		if (++count % 100 == 0) {
			console.log("stat received %d, bat = %d", count, osdData["bat"]);
			console.log(`stat from ${info.address}, ${info.port}`);
		}
		msg = msg.toString().trim();
		let fieldList = msg.split(';');
		fieldList.forEach(function (field) { let [key, value] = field.split(':'); osdData[key] = value; })
	});

	sockStat.on('listening', () => { const address = sockStat.address(); console.log(`server listening ${address.address}:${address.port}`); });

	sockStat.bind(STAT_PORT, WILD_IP);
};

// send command to tello
const msgCommand = Buffer.from('command');

sockCmd.send(msgCommand, 0, msgCommand.length, CMD_PORT, TELLO_IP, (err) => {
	if (err) {
		console.log('connection error', err);
		sockCmd.close();
	}
	startHeartBeat();
});

console.log('---------------------------------------');
console.log('Tello Scratch Ext running at http://127.0.0.1:8001/');
console.log('---------------------------------------');

http.createServer(function (request, response) {
	response.setHeader("Access-Control-Allow-Origin", "*");
	let url_params = request.url.split('/');
	if (url_params.length < 2) return;
	let command = url_params[1];
	if (command == 'poll') {
		let rst = '';
		for (let k in osdData) {
			rst += `${k} ${osdData[k]}\n`;
		}
		response.end(rst);
	} else if (command == 'takeoff') {
		sendCmd('command');
		sendCmd('takeoff');
	} else if (command == "takepicture") {
		sendCapture(url_params, response);
		return;
	} else if (command == "videopage") { 
		sendFile("./src/video.html", response);
		return;
	} else {
		let cmd = url_params.slice(1).join(' ');
		console.log('[lhp_debug]request.url.split:  %s\n', cmd);
		sendCmd(cmd);
		if (command == 'streamon') {
			startCap();
		} else if (command == 'streamoff') {
			stopCap();
		}
	}
	response.end('Hello Tello.\n');
}).listen(HTTP_PORT);

process.on('SIGINT', function () {
	order = [];
	sockCmd.close();
	sockStat.close();
	clearInterval(heartbeatId);
	clearTimeout(cvCaptureTimeid);
	stopCap();
	cv.destroyAllWindows();
	console.log('Goodbye !');
	process.exit();
})

let cvCaptureTimeid = 0;

function startCap() {
	if (CAPTURE_METHOD == "CV") {
		startCvCap();
	} else if (CAPTURE_METHOD == "FFPLAY") {
		startFfplay();
	}
}

function stopCap() {
	if (CAPTURE_METHOD == "CV") {
		stopCvCap();
	} else if (CAPTURE_METHOD == "FFPLAY") {
		stopFfplay();
	}
}

let connectingCapture = false;
function startCvCap() {
	if (wCap || connectingCapture) return;

	connectingCapture = true;

	cvCaptureTimeid = setTimeout(() => {
		if (wCap == null && cvCaptureTimeid != 0) {
			console.log("cv capture starting...");
			//wCap = new cv.VideoCapture(`udp://${TELLO_IP}:${VIDEO_PORT}`);
			wCap = new cv.VideoCapture(`./resources/video/neco06_720.mp4`);
			wCap.set(cv.CAP_PROP_FOURCC, cv.VideoWriter.fourcc("H264"));
			console.log("cv capture started!");
			connectingCapture = false;

			const loopf = () => {
				if (wCap) {
					const frame = wCap.read();
					if (!frame.empty) {
						cv.imshow('capture', frame);
						let k = cv.waitKey(100);
						if (cvCaptureTimeid != 0) {
							cvCaptureTimeid = setTimeout(loopf, 100);
							return;
						};
					};
				}
				stopCvCap();
			}
			cvCaptureTimeid = setTimeout(loopf, 100);
		}
	}, 5000);
}

function stopCvCap() {
	if (wCap) {
		console.log("cv capture stopping...");
		wCap.release();
		clearTimeout(cvCaptureTimeid);
		cv.destroyWindow('capture');
		wCap = null;
		cvCaptureTimeid = 0;
		console.log("cv capture stopped");
	}
}

function startFfplay() {
	if (ffplayProcess) return;
	console.log("ffplay starting...");
	ffplayProcess = child_process.spawn(FFPLAY_PATH, FFPLAY_OPTIONS);
	ffplayProcess.on("error", function (err) {
		console.error(err);
		ffplayProcess = null;
	});
	ffplayProcess.on("close", function (code) {
		console.log("ffplay closed code:%d", code);
		ffplayProcess = null;
	});
}

function stopFfplay() {
	if (ffplayProcess == null) return;
	ffplayProcess.kill();
}

function startHeartBeat() {
	heartbeatId = setInterval(() => {
		if (order.length == 0) {
			sendCmd('command');
		}
	}, HEARTBEAT_INTERVAL);
}

function sendCapture(args, res) {
	if (wCap) {
		const frame = wCap.read();
		if (!fs.existsSync('./capture')) {
			fs.mkdirSync('./capture');
		}
		const file = `./capture/${Date.now()}.png`
		cv.imwrite(file, frame);
		type = "image/png";
		sendFile(file, res);
	} else {
		sendCatPic(args, res);
	}
}

const ImageDir = "./resources/img";
let pictures = null;
let pidx = 0;

function sendCatPic(args, res) {
	if (pictures == null) {
		fs.readdir(ImageDir, (err, files) => {
			if (err) throw err;
			pictures = files.map(p => ImageDir + "/" + p);
			sendCatPic(args, res);
		});
	} else {
		const p = pictures[pidx];
		sendFile(p, res);
		if (pictures.length <= ++pidx) {
			pidx = 0;
		}
	}
}

function sendFile(file, res) {
	switch (path.extname(file).toLowerCase()) {
		case ".jpg":
		case ".jpeg":
			type = "image/jpeg";
			break;
		case ".png":
			type = "image/png";
			break;
		case ".svg":
			type = "image/svg+xml";
			break;
		case ".html":
			type = "text/html";
			break;
		default:
			throw new Error("invalid image type " + file);
	}

	const s = fs.createReadStream(file);
	s.on("open", () => {
		res.setHeader("Content-Type", type);
		s.pipe(res);
		console.log("send " + file);
	});
	s.on("error", () => {
		res.setHeader("Content-Type", "text/plain");
		res.statusCode = 404;
		res.end("no image");
	});
}

listenState();
