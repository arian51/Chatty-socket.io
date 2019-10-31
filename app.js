var http = require("http"),
	url = require("url"),
	path = require("path"),
	mime = require("mime"),
	fs = require("fs"),
	SocketIOFileUploadServer = require("../server"),
	socketio = require("socket.io"),
	express = require("express");

var app, io;

app = express()
	.use(SocketIOFileUploadServer.router)
	.use(express.static(__dirname + "/out"))
	.use(express.static(__dirname + "/public_html"))
	.listen(4567);
io = socketio.listen(app);
console.log("Listening on port 4567");

io.sockets.on("connection", function(socket){

	console.log('made socket connection', socket.id);

    // Handle chat event
    socket.on('chat', function(data){
        console.log(data);
        io.sockets.emit('chat', data);
    });

	var siofuServer = new SocketIOFileUploadServer();
	siofuServer.on("saved", function(event){
		console.log(event.file);
		event.file.clientDetail.base = event.file.base;
	});
	siofuServer.on("error", function(data){
		console.log("Error: "+data.memo);
		console.log(data.error);
	});
	siofuServer.on("start", function(event){
		if (/\.exe$/.test(event.file.name)) {
			console.log("Aborting: " + event.file.id);
			siofuServer.abort(event.file.id, socket);
		}
	});
	siofuServer.dir = "uploads";
	siofuServer.maxFileSize = 3000000;
	siofuServer.listen(socket);
});
