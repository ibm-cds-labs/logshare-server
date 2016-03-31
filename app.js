var express = require('express'),
   cfenv = require('cfenv'),
   moment = require('moment'),
   debug = require('debug')('logshare'),
   dbtools = require('./lib/dbtools.js'),
   async = require('async');

// create a new express server with Redis sessions
var app = express();
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var redis = require('./lib/redis.js')();
var sess = session({
  store: new RedisStore({ client: redis}),
  name: 'JSESSIONID', 
  secret: 'logshare'
});
app.use(sess);
var server = require('http').Server(app);

// socket.io
var ios = require('./lib/ios.js');
var io = require('socket.io')(server);
io.use(ios(sess)); // session support - see socket.io-express-session

// express middleware
var bodyParser = require('body-parser');
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'jade');

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// other libraries service
var redis = require('./lib/redis.js')();
var redispubsub = require('./lib/redis.js')();
var uuid = require('./lib/uuid.js');
var stub = "logshare_";
var livesockets = {};

// subscribe to all changes
redispubsub.psubscribe(stub+"*");

// create a new database, make it world read/write
app.get('/start', function(req,res) {
  debug('GET /start');
  var id = uuid.generate();
  debug('New token',id);
  var channelname = stub + id;
  var metaname = channelname + "_meta";
  var meta = { start: moment().format(), end: null, messages: 0, bytes: 0 };
  redis.hmset(metaname, {
    start: moment().format(),
    messages: 0,
    bytes: 0
  });
  res.send({ ok: true, 
             id: id, 
             shareurl: appEnv.url + '/share/' + id, 
             channelname: channelname});
});

var calculateChannelname = function(id) {
  return stub + id;
};

var calculateMetaname = function(channelname) {
  return channelname + "_meta";
};


var publish = function(id, body, callback) {
  var channelname = calculateChannelname(id);
  var metaname = calculateMetaname(channelname);
  redis.exists(metaname, function (err, data) {
    if (err || data == 0) {
      debug("Invalid token", id)
      return callback(true, {ok: false, err: "invalid token"});      
    }
    redis.multi()
      .publish(channelname, body)
      .hincrby(metaname, 'messages', 1)
      .hincrby(metaname, 'bytes', body.length)
      .exec(function(err, replies) {
        callback(null, {ok: true});
      })
    debug("Published", body.length, "bytes to", id);
  });
};

// create a new database, make it world read/write
app.post('/publish/:id', bodyParser.urlencoded(), function(req,res) {
  debug('POST /publish/:id');
  if (!req.params.id) {
    return res.status(404).send({ok: false, err: "invalid token"});
  }
  if (typeof req.body.body == 'undefined' || req.body.body.length == 0) {
    return res.status(404).send({ok: false, err: "no body parameter found"});
  }
  publish(req.params.id, req.body.body, function(err, data) {
    if (err) {
      return res.status(404).send({ok: false, err: "invalid token"});      
    }
    res.send(data);
  });
});

// delete the database
app.get('/stop/:id', function(req,res) {
  debug('POST /stop/:id');
  if (!req.params.id) {
    return res.status(404);
  }
  var channelname = calculateChannelname(req.params.id);
  var metaname = calculateMetaname(channelname);
  redis.hgetall(metaname, function(err, data) {
    if (err || Object.keys(data).length == 0) {
      debug('Invalid token', req.params.id);
      return res.status(404).send({ok: false});
    } else {
      data.end=moment().format();
      var start = moment(data.start);
      var end = moment(data.end);
      data.bytes = parseInt(data.bytes);
      data.messages = parseInt(data.messages);
      data.duration = end.diff(start, 'seconds');
      debug("Stopped", req.params.id, data);
      dbtools.log(data, function(err, data) {
        redis.del(metaname);
        res.send({ok: true, id: req.query.id})
      });
    }
  });
});

app.get('/share/:id', function(req,res) {
  debug('GET /share/:id');
  var channelname = calculateChannelname(req.params.id);
  var metaname = calculateMetaname(channelname);
  redis.exists(metaname, function (err, data) {
    if (err || data == 0) {
      debug('Invalid token', req.params.id);
      return res.status(404).send({ok: false, err: "invalid token"});      
    }
    res.render('share', { id: req.params.id });
  });
});

app.get('/', function(req,res) {
  debug('GET /');
  res.render('index', { id: req.params.id });
});

io.on('connection', function (socket) {
  debug("Socket.io: New connection", socket.id);

  // when it subscribes
  socket.on('subscribe', function (data) {
    if (!data || !data.id) {
      return;
    }
    var channelname = calculateChannelname(data.id);
    var metaname = calculateMetaname(channelname);
    redis.exists(metaname, function (err, d) {
      if (err || d == 0) {
        socket.emit("baddata", { id: data.id});
        debug("Socket.io: Invalid subscribe request", data.id)
        return;      
      }
      socket.channelname = channelname
      livesockets[socket.id] = socket;
      debug("Socket.io: New livesocket request", socket.id, "(", Object.keys(livesockets).length, ")")      
    });
  });
  
  socket.on('publish', function(data) {
    debug("Socket.io: publish", socket.id);
    publish(data.id, data.body, function(err, data) {
      if (err) {
        socket.emit("baddata", { id: data.id});
      }
    })
  })
  
  // when it dies
  socket.on('disconnect', function(reason) {
    debug("Socket.io: disconnect", socket.id)
    for(var i in livesockets) {
      var s = livesockets[i];
      if (s.id == socket.id) {
        delete livesockets[i];
        debug("Socket.io: Deleted livesocket", socket.id, "(", Object.keys(livesockets).length, ")")      
      }
    }
  });
});

// subscribe to all logshare_* messages
redispubsub.on('pmessage',function(pattern, channel, data) {
  debug("Redis: pmessage on channel", channel)
  for(var i in livesockets) {
    var s = livesockets[i];
    if (s.channelname == channel) {
      debug("Socket.io sending to socket", s.id)
      s.emit('data', data); 
    }
  }
});

// start server on the specified port and binding host
server.listen(appEnv.port, '0.0.0.0', function() {

	// print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});

require("cf-deployment-tracker-client").track();