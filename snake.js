const uWS = require('uWebSockets.js');
const { pack, unpack } = require('msgpackr');

const PORT = 9001;



///////////

const W = 60;
const H = 30;

const CHAR_EMPTY = ' ';
const CHAR_SNAKE = 'O';
const CHAR_FOOD = '*';
const CHAR_OBSTACLE = '#';

const dirLookup = {
    left:  [-1,  0],
    right: [ 1,  0],
    up:    [ 0, -1],
    down:  [ 0,  1]
};

function rndInt(n) {
    return Math.floor( n * Math.random() );
}

class Board {
    constructor(w, h, value='#') {
        this.array = new Array(w*h);
        this.array.fill(value);
        this.w = w;
        this.h = h;
    }

    getIndex(x, y) {
        return this.w * y + x;
    }

    getCell(x, y) {
        return this.array[ this.getIndex(x, y) ];
    }

    setCell(x, y, v) {
        this.array[ this.getIndex(x, y) ] = v;
    }

    toString() {
        const lines = [];
        for (let y = 0; y < this.h; ++y) {
            lines.push( this.array.slice(y*this.w, (y+1)*this.w).join('') );
        }
        return lines.join('\n');
    }

    clone() {
        const c = new Board(this.w, this.h);
        c.array = Array.from(this.array);
        return c;
    }

    diff(other) {
        if (other.w !== this.w || other.h !== this.h) {
            throw new Error('boards must have same size!');
        }
        const res = [];
        for (let i = 0; i < this.array.length; ++i) {
            const thisV = this.array[i];
            if (thisV !== other.array[i]) {
                res.push([i, thisV]);
            }
        }
        return res;
    }

    patch(diffs) {
        for (let [i, v] of diffs) {
            this.array[i] = v;
        }
    }
}

let board0 = new Board(W, H, CHAR_EMPTY); // REFERENCE FOR NEW CLIENTS
let boardPrev = board0.clone();
let board = boardPrev.clone();

class Snake {
    constructor(b, onDied) {
        this.b = b;

        this.glowEvery = 10;
        this.toGrow = this.glowEvery;

        let pos;
        do {
            pos = [
                rndInt(b.w),
                rndInt(b.h)
            ];
        } while (b.getCell(pos[0], pos[1]) !== CHAR_EMPTY);
        
        this.ps = [];
        this.ps.push(pos);

        this.onDied = onDied;

        this.draw();
    }

    clear() {
        const b = this.b;
        for (let pos of this.ps) {
            b.setCell(pos[0], pos[1], CHAR_EMPTY);
        }
    }

    draw() {
        const b = this.b;
        for (let pos of this.ps) {
            b.setCell(pos[0], pos[1], CHAR_SNAKE);
        }
    }

    isValidPosition([x, y]) {
        return x >= 0 && y >= 0 && x < this.b.w && y < this.b.h;
    }

    move() {
        if (this.died) return;

        const tip = Array.from(this.ps[0]);
        const dP = dirLookup[this.dir];

        if (!dP) {
            return;
        }

        tip[0] += dP[0];
        tip[1] += dP[1];

        // TODO NOT WORKING WELL BECAUSE BOARD IS EMPTY AND GETCELL WILL NEVER FAIL
        if (!this.isValidPosition(tip) || this.b.getCell(tip[0], tip[1]) !== CHAR_EMPTY) {
            this.died = true;
            this.onDied && this.onDied()
            return;
        }

        this.ps.unshift(tip);

        --this.toGrow;

        let grows = false;
        if (this.toGrow === 0) {
            grows = true;
            this.toGrow = this.glowEvery;
        }

        if (!grows) {
            this.ps.pop();
        }
    }

    getTipValue() {
        const [x, y] = this.ps[0];
        return this.b.getCell(x, y);
    }
}

const snake = new Snake(board, () => {
    _ws && _ws.send(pack({ op:'game-over' }), true);
});

function onTick() {
    if (!_ws) return;

    snake.clear();
    snake.move();
    snake.draw();

    const diff = board.diff(boardPrev);

    if (diff.length > 0) {
        _ws.send(pack({ op:'board-diff', diff:board.diff(boardPrev) }), true);
        boardPrev = board.clone();
    }
}

setInterval(onTick, 1000 / 10);



///////////


let _ws;

const _App = uWS.App;
//const _App = uWS.SSLApp;

let maxI = 1;
function getId(ws) {
  return maxI++;
}

/* const map2 = new Map(); // id -> ws
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
} */

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
      //map2.set(ws.id, ws);
      //ids.add(ws.id);
      console.log(`new client: ${ws.id}`);
    }

    ws.send(pack({ op:'own-id', id:ws.id}), true);

    ws.send(pack({ op:'board-init', w:W, h:H }), true);

    ws.send(pack({ op:'board-diff', diff:board.diff(board0) }), true);

    _ws = ws;
  },
  message: (ws, message, isBinary) => {
    if (!isBinary) {
      console.warn(`ignored non-binary incoming message: ${ab2str(message)}`);
      return;
    }

    const data = unpack(Buffer.from(message))

    switch (data.op) {
      case 'key':
        snake.dir = data.key;
        break;
      default:
        console.log(`unsupported opcode: ${data.op}`);
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
      //map2.delete(ws.id);
      //ids.delete(ws.id);
      console.log(`closed ${ws.id} ok`);
    }
    //TODO TEMP
    _ws = undefined;
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
