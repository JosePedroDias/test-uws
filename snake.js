const uWS = require('uWebSockets.js');
const { pack, unpack } = require('msgpackr');

const PORT = 9001;

///////////

const W = 80;
const H = 36;

const CHAR_EMPTY = ' ';
const CHAR_SNAKE = 'O';
const CHAR_FOOD = '*';
const CHAR_OBSTACLE = '#';

const TICK_RATE_MS = 1000 / 10; // 10 times/second

const ADD_FOOD_EVERY_N_TICKS = 30;
const ADD_OBSTACLE_EVERY_N_TICKS = 120;

let ticksLeftForFood = ADD_FOOD_EVERY_N_TICKS;
let ticksLeftForObstacle = ADD_OBSTACLE_EVERY_N_TICKS;

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

    getRandomCellWithValue(value=CHAR_EMPTY) {
        let pos;
        do {
            pos = [
                rndInt(this.w),
                rndInt(this.h)
            ];
        } while (this.getCell(pos[0], pos[1]) !== value);
        return pos;
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

class Snake {
    constructor(b, onDied) {
        this.b = b;

        this.glowEvery = 10;
        this.toGrow = this.glowEvery;

        this.ps = [];
        const pos = b.getRandomCellWithValue(CHAR_EMPTY);
        this.ps.push(pos);

        this.onDied = onDied;

        b.setCell(pos[0], pos[1], CHAR_SNAKE);
    }

    isValidPosition([x, y]) {
        return x >= 0 && y >= 0 && x < this.b.w && y < this.b.h;
    }

    move() {
        if (this.died) return;

        const b = this.b

        const tip = Array.from(this.ps[0]);
        const dP = dirLookup[this.dir];

        if (!dP) return;

        tip[0] += dP[0];
        tip[1] += dP[1];

        let grows = false;

        let collided = !this.isValidPosition(tip);
        if (!collided) {
            const v = this.b.getCell(tip[0], tip[1]) ;
            if (v === CHAR_FOOD) {
                grows = true;
            } else if (v !== CHAR_EMPTY) {
                collided = true;
            }
        }

        if (collided) {
            this.died = true;
            this.onDied && this.onDied()
            return;
        }

        this.ps.unshift(tip);
        b.setCell(tip[0], tip[1], CHAR_SNAKE);

        --this.toGrow;

        if (this.toGrow === 0) {
            grows = true;
            this.toGrow = this.glowEvery;
        }

        if (!grows) {
            const tail = this.ps.pop();
            b.setCell(tail[0], tail[1], CHAR_EMPTY);
        }
    }

    getTipValue() {
        const [x, y] = this.ps[0];
        return this.b.getCell(x, y);
    }
}

let board0 = new Board(W, H, CHAR_EMPTY); // REFERENCE FOR NEW CLIENTS
let boardPrev = board0.clone();
let board;

let snakes = new Map(); // id -> snake

function addSnake(id) {
    const snake = new Snake(board, () => {
        broadcast({ op:'game-over' });
        setTimeout(reset, 1000);
    });

    snakes.set(id, snake);
}

function removeSnake(id) {
    const snake = snakes.get(id);

    for (const [x, y] of snake.ps) {
        board.setCell(x, y, CHAR_EMPTY);
    }

    snakes.delete(id);
}

function reset() {
    snakes = new Map();
    board = board0.clone();
    for (const id of idToWsInstance.keys()) addSnake(id);
}

function onTick() {
    --ticksLeftForFood;
    if (ticksLeftForFood === 0) {
        const [x,y] = board.getRandomCellWithValue(CHAR_EMPTY);
        board.setCell(x, y, CHAR_FOOD);
        ticksLeftForFood = ADD_FOOD_EVERY_N_TICKS;
    }

    --ticksLeftForObstacle;
    if (ticksLeftForObstacle === 0) {
        const [x,y] = board.getRandomCellWithValue(CHAR_EMPTY);
        board.setCell(x, y, CHAR_OBSTACLE);
        ticksLeftForObstacle = ADD_OBSTACLE_EVERY_N_TICKS;
    }

    for (const snake of snakes.values()) snake.move();

    const diff = board.diff(boardPrev);

    if (diff.length > 0) {
        broadcast({ op:'board-diff', diff:board.diff(boardPrev) });

        boardPrev = board.clone();
    }
}

setInterval(onTick, TICK_RATE_MS);

///////////

const _App = uWS.App;
//const _App = uWS.SSLApp;

let maxId = 1;
function getId(ws) {
  return maxId++;
}

const idToWsInstance = new Map(); // id -> ws

function broadcast(msg) {
    const msgO = pack(msg);
    const wss = Array.from(idToWsInstance.values());
    for (const ws of wss) ws.send(msgO, true);
}

reset();

_App({
  key_file_name: 'misc/key.pem',
  cert_file_name: 'misc/cert.pem',
  passphrase: '1234'
}).ws('/*', {
  compression: uWS.SHARED_COMPRESSOR,
  maxPayloadLength: 4 * 1024, // bytes?
  idleTimeout: 60, // secs?

  open: (ws) => {
    console.log('WebSocket connected!');

    ws.id = getId(ws);
    idToWsInstance.set(ws.id, ws);
    console.log(`  new client: ${ws.id}`);

    ws.send(pack({ op:'own-id', id:ws.id}), true);
    ws.send(pack({ op:'board-init', w:W, h:H }), true);
    ws.send(pack({ op:'board-diff', diff:board.diff(board0) }), true);

    addSnake(ws.id);
  },
  message: (ws, message, isBinary) => {
    if (!isBinary) {
      console.warn(`ignored non-binary incoming message: ${ab2str(message)}`);
      return;
    }

    const data = unpack(Buffer.from(message))

    switch (data.op) {
      case 'key':
        {
            const snake = snakes.get(ws.id);
            snake.dir = data.key;
        }
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
    removeSnake(ws.id);
    idToWsInstance.delete(ws.id);
    console.log(`  closed ${ws.id} ok`);
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
