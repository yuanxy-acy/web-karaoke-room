var ws;
var wspw;
var status = "offline";

function login() {
	$("#login").css("display", "none");
	$.get("use/login?pw=" + $("#login-pw").val(), (g) => {
		if (g == "fail") {
			alert("密码错误");
			$("#login").css("display", "block");
		} else {
			wspw = g;
			linkws(wspw);
		}
	});
}

function loginplayer() {
	$.post("ncm/login/cellphone?", {
		phone: $("#username").val(),
		password: $("#password").val()
	}, (g) => {
		if (g.code == 200) {
			alert("登陆成功")
		} else {
			alert(g.message);
		}
	}, "json");
}

function ncmgeturl(id, callback) {
	$.post("ncm/song/url/v1", {
		id: id,
		level: 'exhigh'
	}, (g) => {
		callback(insertStr(g.data[0].url, 4, 's'));
	}, "json");
}

function qqmgeturl(id, time, callback) {
	$.get("qqm/song/url?id=" + id, (g) => {
		if (g.result != 100) {
			alert("获取qq音乐播放链接失败");
			console.log(g);
			del(time);
			nextsong();
			return;
		}
		callback(insertStr(g.data, 4, 's'));
	}, "json");
}

function del(time) {
	while (true) {
		if (status == "online") {
			ws.send('{"cmd":"del","time":' + time + '}');
			list.splice(list.findIndex(i => i.time === time), 1);
			count--;
			reloadlist();
			break;
		}
	}
}

function totop(time) {
	while (true) {
		if (status == "online") {
			ws.send('{"cmd":"top","time":' + time + '}');
			list.unshift(list.splice(list.findIndex(i => i.time === time), 1)[0]);
			reloadlist();
			break;
		}
	}
}

function nextsong() {
	if (list.length != 0) {
		ws.send('{"cmd":"nextsong"}');
	} else {
		ws.send('{"cmd":"noplaying"}');
		alert("播放列表为空");
	}
}

function linkws(pw) {
	var supportsWebSockets = 'WebSocket' in window || 'MozWebSocket' in window;
	if (supportsWebSockets) {
		ws = new WebSocket("wss://music.yuanxy-acy.online/use/host?pw=" + pw);
		ws.onopen = function() {
			console.log("websocket连接成功");
			status = "online";
			getlist();
			ws.send('{"cmd":"log","log":"linked"}');
		}
		ws.onmessage = function(e) {
			data = JSON.parse(e.data);
			if (data.message == "cmd") {
				switch (data.cmd) {
					case "refresh":
						getlist();
						break;
					case "add":
						count++;
						list.push(data.info);
						var dom = $("<div>" + (count) + " <b>" + data.info.name + "</b><button onclick='del(" +
							data.info.time + ");'>删除</button><button onclick='totop(" + data.info.time +
							");'>置顶</button></div>");
						$("#list").append(dom);
						if (count < 1 && list.length != 0) {
							nextsong();
						}
						break;
					case "play":
						let url;
						let callback = (url) => {
							console.log(url);
							$("#player").attr("src", url);
							ws.send(JSON.stringify({
								cmd: "playing",
								id: data.id,
								name: data.name,
								type: data.type,
								time: data.time
							}));
							$("#playing").empty();
							$("#playing").append("正在播放" + " <b>" + data.name + "</b>");
							del(data.time);
						}
						switch (data.type) {
							case "ncm":
								ncmgeturl(data.id, callback);
								break;
							case "qqm":
								qqmgeturl(data.id, data.time, callback);
								break;
							default:
								alert("未知音乐类型");
								del(data.time);
						}
						break;
					default:
						console.log("unknow command:" + data.cmd);
				}
			} else if (data.message == "log") {
				console.log(data.log);
			}
		}
		ws.onclose = function(e) {
			console.log("websocket已断开");
			status = "offline";
			linkws(wspw);
		}
		ws.onerror = function(e) {
			console.log("websocket发生错误" + e);
		}
	} else {
		layer.alert("您的浏览器不支持 WebSocket!");
	}
}