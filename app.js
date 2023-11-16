const http = require('http');
const url = require('url');
const querystring = require("querystring");
const fs = require('fs');
const WebSocket = require('ws');
const crypto = require('crypto');
const redis = require("redis");
const mysql = require('mysql');
const axios = require('axios');
const sqlstring = require('sqlstring');
const redisConfig = {
	'url': 'redis://default:henry200312311@127.0.0.1:6379'
}
const wsshost = new WebSocket.WebSocketServer({
	noServer: true
});
const wssguest = new WebSocket.WebSocketServer({
	noServer: true
});
const port = 3002;
var status = "offline";
var wspw;
var hostws;
var list = [];
var playing = {};
var played = {};
var ifplaying = false;
const publisher = redis.createClient(redisConfig);
publisher.connect();
var sqlclient = mysql.createPool({
	host: "127.0.0.1",
	user: 'music',
	password: 'music123',
	database: "music"
});

const server = http.createServer((req, res) => {
	var pathname = url.parse(req.url).pathname;
	res.statusCode = 200;
	switch (pathname) {
		case "/status":
			res.setHeader('Content-Type', 'text/plain');
			res.end(status);
			break;
		case "/list":
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(list));
			break;
		case "/played_list":
			sqlclient.getConnection(function(error, conn) {
				if (err) {
					console.log('[query] - :' + err);
					return;
				}
				conn.query("SELECT * FROM songlist", function(err, result) {
					if (err) {
						console.log('[SELECT ERROR] - ', err.message);
						return;
					}
					res.end(JSON.stringify(result));
					conn.release();
				});
			});
			break;
		case "/login":
			res.setHeader('Content-Type', 'text/plain');
			fs.readFile("password", function(err, data) {
				const md5 = crypto.createHash('md5');
				if (err) {
					console.log(err);
					wspw = md5.update(Math.random() + "").digest('hex');
					res.write(wspw);
				} else {
					if (querystring.parse(url.parse(req.url).query).pw == data.toString()) {
						wspw = md5.update(Math.random() + "").digest('hex');
						res.write(wspw);
					} else {
						res.write("fail");
					}
				}
				res.end();
			});
			break;
		case "/add":
			res.setHeader('Content-Type', 'text/plain');
			var query = querystring.parse(url.parse(req.url).query);
			let reg = /(qqm|ncm)/;
			if(!reg.test(query.type)){
				res.end('error type');
				return;
			}
			if(query.name == null){
				res.end('no name');
				return;
			}
			console.log(query.id);
			time = process.hrtime();
			Object.assign(query, {
				time: time[0] * 1000000000 + time[1]
			});
			list.push(query);
			res.end("success");
			guestcmd("add", {
				info: query
			});
			if (status == "online") {
				hostws.send(JSON.stringify({
					message: "cmd",
					cmd: "add",
					info: query
				}));
			}
			break;
		case "/302_share_url":
			res.setHeader('Content-Type', 'text/plain');
			let share_url = '';
			req.on('data', function(data) {
				share_url += data;
			});
			req.on('end', function() {
				console.log(share_url);
				axios({
					url: share_url,
					method: 'get',
					maxRedirects: 0
				}).then(res => {
					consoloe.log(res.status, res.data);
				}).catch(err => {
					if (err.response) {
						if (err.response.status == 302) {
							res.end(err.response.headers.location);
						}
					} else {
						console.log(err);
						res.end('fail');
					}
				});
			});
			break;
		default:
			res.statusCode = 404;
			res.setHeader('Content-Type', 'text/plain');
			res.end('NO FOUND');
	}
}).listen(port, () => {
	console.log(`服务器运行在 ${port}`);
});

server.on('upgrade', function upgrade(request, socket, head) {
	var pathname = url.parse(request.url).pathname;
	switch (pathname) {
		case "/host":
			if (querystring.parse(url.parse(request.url).query).pw == wspw) {
				wsshost.handleUpgrade(request, socket, head, function done(ws) {
					status = "online";
					wsshost.emit('connection', ws, request);
				});
			} else {
				console.log(querystring.parse(url.parse(request.url).query).pw);
				console.log(wspw);
				socket.destroy();
			}
			break;
		case "/guest":
			wssguest.handleUpgrade(request, socket, head, function done(ws) {
				wssguest.emit('connection', ws, request);
			});
			break;
		default:
			socket.destroy();
	}
});
var sendErr = function(err) {
	if (err) {
		console.log(`[SERVER] error:${err}`);
		this.send('{"message":"fail"}');
	}
}

function guestcmd(cmd, args) {
	publisher.publish("guestmsg", JSON.stringify(Object.assign({
		message: "cmd",
		cmd: cmd
	}, args)));
}

wsshost.on('connection', function(ws) {
	console.log(`[SERVER] host connection()`);
	hostws = ws;
	ws.on("close", function() {
		status = "offline";
	});
	ws.on('message', function(message) {
		let data;
		try {
			data = JSON.parse(message);
		} catch (e) {
			console.log(e);
		}
		switch (data.cmd) {
			case "top":
				list.unshift(list.splice(list.findIndex(i => i.time === data.time), 1)[0]);
				guestcmd("top", {
					id: data.time
				});
				ws.send('{"message":"success"}', sendErr);
				break;
			case "del":
				list.splice(list.findIndex(i => i.time === data.time), 1);
				guestcmd("del", {
					id: data.time
				});
				ws.send('{"message":"success"}', sendErr);
				break;
			case "log":
				ws.send('{"message":"log","log":"' + data.log + '"}', sendErr);
				break;
			case "playing":
				ifplaying = true;
				playing = {
					id: data.id,
					name: data.name,
					type: data.type,
					time: data.time
				};
				guestcmd("playing", playing);
				break;
			case "noplaying":
				ifplaying = false;
				guestcmd("noplaying");
				break;
			case "nextsong":
				played = playing;
				sqlclient.getConnection(function(err,conn){
					if (err) {
						console.log('[query] - :' + err);
						return;
					}
					conn.query(sqlstring.format('INSERT INTO table_name (time,id,name,type)VALUES (?,?,?,?)',), function(err, result) {
						if (err) {
							console.log('[SELECT ERROR] - ', err.message);
							return;
						}
						res.end(JSON.stringify(result));
						conn.release();
					});
				});
				ws.send(JSON.stringify(Object.assign({
					message: "cmd",
					cmd: "play"
				}, list[0])));
				break;
			default:
				ws.send('{"message":"unkonw command"}', sendErr);
		}
	});
});

async function wssublisher(ws) {
	ws.sublisher = await redis.createClient(redisConfig);
	ws.sublisher.connect();
	ws.sublisher.subscribe("guestmsg", (message) => {
		ws.send(message);
	});
	ws.sublisher.on("error", (err) => {
		console.log("response err:" + err);
	});
}

wssguest.on('connection', function(ws) {
	console.log(`[SERVER] guest connection()`);
	wssublisher(ws);
	ws.on("close", function() {
		ws.sublisher.disconnect();
	});
	ws.on('message', function(message) {
		let data;
		try {
			data = JSON.parse(message);
		} catch (e) {
			console.log(e);
		}
		switch (data.cmd) {
			case "log":
				ws.send('{"message":"log","log":"' + data.log + '"}', sendErr);
				break;
			case "playing":
				if (ifplaying) {
					ws.send('{"message":"cmd","cmd":"playing","name":"' + playing.name + '"}', sendErr);
				} else {
					ws.send('{"message":"cmd","cmd":"noplaying"}', sendErr);
				}
				break;
			default:
				ws.send('{"message":"unkonw command"}', sendErr);
		}
	});
});