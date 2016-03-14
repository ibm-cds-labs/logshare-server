# logshare

Simple log-sharing utility built with Node.js, Redis and Cloudant.

## Installation

    npm install -g logshare
  
## Running

    >tail -f /var/log/system.log | logshare
    Share URL: https://logshare.mybluemix.net/share/kkdgapgdx

Put the URL in your browser and share it with the people you want to share your data with.

![Demo](https://raw.githubusercontent.com/ibm-cds-labs/logshare-server/master/public/img/demo.gif)

Alternatively, they can run logshare too to consume the data in their terminal like this:

    > logshare https://logshare.mybluemix.net/share/kkdgapgdx

or

    > logshare kkdgapgdx

to consume the stream of logs at their terminal.

## Stopping
  
    Ctrl-C

When `logshare` is killed, it deletes the data you streamed to it.

## Live Demo

Visit [https://logshare.mybluemix.net](https://logshare.mybluemix.net) for a live demo.


## What is this code?

This is the server-side code for `logshare`. The client-side code lives in a [separate repository](https://github.com/ibm-cds-labs/logshare-client).


## HTTP API Reference

### GET /start

Initiates a logshare session:

Returns a JSON object:

```js
{"ok":true,"id":"dolpdpbld","shareurl":"https://logshare.mybluemix.net/share/dolpdpbld","channelname":"logshare_dolpdpbld"}
```

which includes the session id, the share URL and the Redis pubsub channel name.

### POST /publish/:id

Publishes a line of data to the logshare session identified by `id`. Expects a form-encoded body containing a single parameter `body` which contains the data to be published. Returns 200 on success or 404 if the id is not recognised.

### GET /stop/:id

Stops the logshare session identified by `id`. Stores meta data and prevents further data being published


## WebSockets API Reference

### On 'subscribe'

Expects a message containing an `id` which is the id of the logshare session to subscribe to. If the session id exists, then the current WebSocket is associated with the that logshare id.

### On 'publish'

Expects a message containing an 'id' and a 'body'. If the logshare id exists, then data is written to Redis.

### On 'disconnect'

Removes the reference to the websocket.






