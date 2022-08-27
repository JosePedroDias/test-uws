https://github.com/uNetworking/uWebSockets.js/
https://github.com/uNetworking/uWebSockets.js/tree/master/examples
https://unetworking.github.io/uWebSockets.js/generated/

https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket
https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/binaryType

https://github.com/kriszyp/msgpackr


## broadcast

everything received is sent to every other client (with from:id)

```
http-server . -c-1 -p 8090 --cors &
node broadcast
```

visit http://127.0.0.1:8090/basic.html -> ws://127.0.0.1:9001

## autho

simplest auth server ever: ignores consecutive messages from the same sender reaching others

```
http-server . -c-1 -p 8090 --cors &
node autho
```

visit http://127.0.0.1:8090/basic.html -> ws://127.0.0.1:9001

## snake

sends arrow keys. receives board diffs

```
http-server . -c-1 -p 8090 --cors &
node snake
```

visit http://127.0.0.1:8090/snake.html -> ws://127.0.0.1:9001
