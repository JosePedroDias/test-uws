const uWS = require('uWebSockets.js');
const { pack, unpack } = require('msgpackr');

const PORT = 9001;

const _App = uWS.App;
//const _App = uWS.SSLApp;

const utf8enc = new TextDecoder("utf-8");

function ab2str(arr) {
  return utf8enc.decode(arr);
}

let maxI = 1;
function getId(ws) {
  return maxI++;
}

const map2 = new Map(); // id -> ws
const ids = new Set();

function otherIds(ownId) {
  const res = [];
  for (const id of ids.keys()) {
    if (id !== ownId) {
      res.push(id);
    }
  }
  return res;
}

function sendToOthers(ownId, msg_) {
  const msg = pack(msg_);
  otherIds(ownId).map(id => map2.get(id)).forEach(ws => ws.send(msg, true));
}

let lastSendWasFrom;

const app = _App({
  key_file_name: 'misc/key.pem',
  cert_file_name: 'misc/cert.pem',
  passphrase: '1234'
}).ws('/*', {
  //compression: 0,
  compression: uWS.SHARED_COMPRESSOR,
  maxPayloadLength: 16 * 1024 * 1024,
  idleTimeout: 60, // secs?

  open: (ws) => {
    console.log('A WebSocket connected!');

    if (!ws.id) {
      ws.id = getId(ws);
      map2.set(ws.id, ws);
      ids.add(ws.id);
      console.log(`new client: ${ws.id}`);
    }

    //ws.send(`you're ${ws.id}`));
    ws.send(pack(`you're ${ws.id}`), true);
  },
  message: (ws, message_, isBinary) => {
    //console.log(message_);
    const message = isBinary ? unpack(Buffer.from(message_)) : ab2str(message_);

    console.log(`${ws.id}: ${JSON.stringify(message)}`);

    if (lastSendWasFrom === ws.id) {
      ws.send(pack(`you're spamming! ignored this message ${message}`), true);
    } else {
      sendToOthers(ws.id, `${ws.id}: ${message}`);
      lastSendWasFrom = ws.id;
    }
  },
  drain: (ws) => {
    console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
  },
  close: (ws, code, message) => {
    console.log(`WebSocket closed with ${code}`);

    if (!ws.id) {
      console.log('oops');
    } else {
      map2.delete(ws.id);
      ids.delete(ws.id);
      console.log(`closed ${ws.id} ok`);
    }
  }
}).any('/*', (res, req) => {
  res.end('Nothing to see here!');
}).listen(PORT, (token) => {
  if (token) {
    console.log(`Listening to port ${PORT}`);
  } else {
    console.log(`Failed to listen to ${PORT}`);
  }
});
