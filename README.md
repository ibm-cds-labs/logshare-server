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

## Deploy to Bluemix

## Running the app on Bluemix

If you want to deploy your own logshare server click the **Deploy to Bluemix** button below.


[![Deploy to Bluemix](https://deployment-tracker.mybluemix.net/stats/3fba8995133dc6e864d2b621048a940f/button.svg)](https://bluemix.net/deploy?repository=https://github.com/ibm-cds-labs/logshare-server)

**Don't have a Bluemix account?** If you haven't already, you'll be prompted to sign up for a Bluemix account when you click the button.  Sign up, verify your email address, then return here and click the the **Deploy to Bluemix** button again. Your new credentials let you deploy to the platform and also to code online with Bluemix and Git. If you have questions about working in Bluemix, find answers in the [Bluemix Docs](https://www.ng.bluemix.net/docs/).

## Privacy and data retention

This project makes no guarantees as to the privacy of the data that you stream to logshare. If you are using https://logshare.mybluemix.net then the data is encrypted between the producer and server, and between the server and the consumers. There is no authentication mechanism to prevent an unknown third party observing your data stream, if they can guess the nine-digit session token. So don’t consider it safe for confidential data. It is designed to relay streaming data across development teams temporarily, not for anything you wouldn’t want others to see.

This project does not store your data at any time. Log data goes to a Redis pubsub channel and then relays immediately to any connected clients who have subscribed to that session. The data is then discarded, with only meta data about the session (the number of lines of data and the number of bytes of data received) being retained.




