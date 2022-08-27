# TD;DR

Take uWebSockets.js for a spin

# reference

- uWebSockets
    - https://github.com/uNetworking/uWebSockets.js/
    - https://github.com/uNetworking/uWebSockets.js/tree/master/examples
    - https://unetworking.github.io/uWebSockets.js/generated/

- browser websocket API
    - https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket
    - https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
    - https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/binaryType

- msgpack impl
    - https://github.com/kriszyp/msgpackr


# experiments
## 1. broadcast chat

everything received is sent to every other client (with injected from:id)

```
http-server . -c-1 -p 8090 --cors &
node broadcast
```

visit http://127.0.0.1:8090/basic.html -> ws://127.0.0.1:9001

## 2. authoritative chat (no spam)

simplest authoritative server ever: ignores consecutive messages from the same sender reaching others

```
http-server . -c-1 -p 8090 --cors &
node autho
```

visit http://127.0.0.1:8090/basic.html -> ws://127.0.0.1:9001

## 3. authoritative snake

snake game, each client controlling a snake.  
clients send arrow keys and receiving board diffs.

```
http-server . -c-1 -p 8090 --cors &
node snake
```

visit http://127.0.0.1:8090/snake.html -> ws://127.0.0.1:9001


# Remarks

- the server behaves well
- server does least amount of work possible (ie: reading a string message requires using the utf-8 text decoder)
- API encourages stateless (exposes close to 0 besides declared public API)
- no global way of getting hold of existing clients to drive messages to them (had to create my own map)
- API-supported pubsub acts weird. for snake, where events aren't completely driven by incoming messages but also ticks, had to do my own broadcast (probably it queues messages, couldn't confirm - broadcast example works.)
