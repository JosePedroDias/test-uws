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

const app = _App({
  key_file_name: 'misc/key.pem',
  cert_file_name: 'misc/cert.pem',
  passphrase: '1234'
}).ws('/*', {
  //compression: 0,
  compression: uWS.SHARED_COMPRESSOR,
  //maxPayloadLength: 16 * 1024 * 1024, // bytes?
  maxPayloadLength: 4 * 1024, // bytes?
  idleTimeout: 60, // secs?

  open: (ws) => {
    console.log('A WebSocket connected!');

    if (!ws.id) {
      ws.id = getId(ws);
      console.log(`new client: ${ws.id}`);
    }

    ws.subscribe('broadcast');
  },
  message: (ws, message, isBinary) => {
    //const data = isBinary ? unpack(Buffer.from(message)) : ab2str(message);
    if (!isBinary) {
      console.warn(`ignored non-binary incoming message: ${ab2str(message)}`);
      return;
    }

    const data = unpack(Buffer.from(message))

    const data2 = pack({...data, from:ws.id});
    ws.publish('broadcast', data2, true);
  },
  drain: (ws) => {
    console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
  },
  close: (ws, code, message) => {
    console.log(`WebSocket closed with ${code}`);

    if (!ws.id) {
      console.log('oops');
    } else {
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
