var count=0;
var list;
$.get("ncm/register/anonimous");

function reloadlist() {
	$("#list").empty();
	count = 0;
	$.each(list, (i, item) => {
		count = i + 1;
		i = $("<div><p>" + (i + 1) + "</p><b>" + item.name + "</b></div>");
		i.musicid = item.id;
		$("#list").append(i);
	});
}

function getlist() {
	$.getJSON("use/list", (g) => {
		list = g;
		reloadlist();
	});
}

function linkws() {
	var supportsWebSockets = 'WebSocket' in window || 'MozWebSocket' in window;
	if (supportsWebSockets) {
		var ws = new WebSocket("wss://music.yuanxy-acy.online/use/guest");
		ws.onopen = function() {
			console.log("websocket连接成功");
			ws.send('{"cmd":"log","log":"linked"}');
			ws.send('{"cmd":"playing"}');
			getlist();
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
						var dom = $("<div><p>" + (count) + "</p><b>" + data.info.name + "</b></div>");
						$("#list").append(dom);
						break;
					case "top":
						list.unshift(list.splice(list.findIndex(i => i.time === data.time), 1)[0]);
						reloadlist();
						break;
					case "del":
						list.splice(list.findIndex(i => i.time === data.time), 1);
						count--;
						reloadlist();
						break;
					case "playing":
						$("#playing").empty();
						$("#playing").append("正在播放" + " <b>" + data.name + "</b>");
						break;
					case "noplaying":
						$("#playing").empty();
						$("#playing").append("<b>未在播放</b>");
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
			linkws();
		}
		ws.onerror = function(e) {
			alert("websocket发生错误" + e);
		}
	} else {
		layer.alert("您的浏览器不支持 WebSocket!");
	}
}

function insertStr(str, index, insertStr) {
	return str.substring(0, index) + insertStr + str.substring(index)
}

function addncmurl(tmp) {
	let reg = /id=(.*)/;
	tmp = reg.exec(tmp)[0];
	reg = /(\d+\d)/;
	tmp = reg.exec(tmp)[0];
	console.log("ncmid:" + tmp);
	$.getJSON("ncm/song/detail?ids=" + tmp, (get) => {
		$.get("use/add?id=" + tmp + "&name=" + get.songs[0].name + "&type=ncm", (g) => {
			if (g == "success") {
				alert("添加成功");
				$('#musicUrl').val('');
			} else {
				alert("添加失败");
			}
		});
	});

}

function addqqmurl(music_url) {
	let reg = /songmid=[a-zA-Z0-9]+/;
	music_url = reg.exec(music_url)[0];
	console.log("qqmid:" + music_url);
	reg = /[a-zA-Z0-9]+$/;
	music_url = reg.exec(music_url)[0];
	console.log("qqmid:" + music_url);
	$.getJSON("qqm/song?songmid=" + music_url, (get) => {
		$.get("use/add?id=" + music_url + "&name=" + get.data.extras.name + "&type=qqm", (g) => {
			if (g == "success") {
				alert("添加成功");
				$('#musicUrl').val('');
			} else {
				alert("添加失败");
			}
		});
	});
}

function sendmusic() {
	tmp = $("#musicUrl").val();
	let reg = /(http|https):\/\/([a-zA-Z0-9]+\.)+[a-z]+/;
	let type;
	switch (reg.exec(tmp)[0]) {
		case "https://music.163.com":
		case "https://y.music.163.com":
			addncmurl(tmp);
			break;
		case "http://163cn.tv":
			reg = /(http|https):\/\/([a-zA-Z0-9]+\.)+[a-z]+\/[a-zA-Z0-9]+/;
			tmp = reg.exec(tmp)[0];
			$.post("use/302_share_url", tmp, (g) => {
				addncmurl(g);
			});
			break;
		case "https://c6.y.qq.com":
			reg = /(http|https):\/\/([a-zA-Z0-9]+\.)+[a-z]+\/+([a-zA-Z0-9-]+[\/\?])+__=[a-zA-Z0-9-]+/;
			tmp = reg.exec(tmp)[0];
			$.post("use/302_share_url", tmp, (g) => {
				addqqmurl(g);
			});
			break;
		default:
			alert("未知链接")
	}
	$("#form").css("display", "none");
}