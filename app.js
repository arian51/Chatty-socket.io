var http = require("http"),
	url = require("url"),
	path = require("path"),
	mime = require("mime"),
	fs = require("fs"),
	SocketIOFileUploadServer = require("../server"),
	socketio = require("socket.io"),
	express = require("express"),
	mongo = require('mongodb').MongoClient,
	_ = require('lodash');

var app, io;
const mongoUrl = 'mongodb://localhost:27017';

mongo.connect(mongoUrl, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
}, (err, client) => {
	if (err) {
		console.error(err);
		return;
	}

	//----------------------------
	const db = client.db('mongoChat')
	const collection = db.collection('chats')
	//----------------------------

	app = express()
		.use(SocketIOFileUploadServer.router)
		.use(express.static(__dirname + "/out"))
		.use(express.static(__dirname + "/public_html"))
		.listen(4567);
	io = socketio.listen(app);

	console.log("Listening on port 4567");
	// Make collection
	let publicChat = db.collection('chats');

	io.sockets.on("connection", function (socket) {

		console.log('made socket connection', socket.id);

		// Get chat from mongo collection
		publicChat.find().limit(100).sort({ _id: 1 }).toArray(function (err, res) {
			for(var message of res)
			{
				socket.emit('publicChat', message);
			}
		})
		// Handle chat event
		socket.on('publicChat', function (data) {
			let name = data.handle
			let message = data.message

			console.log(data);
			if (name != '' && message != '') {
				io.sockets.emit('publicChat', data);
				publicChat.insert({ handle: name, message: message })
			}
		});

		var siofuServer = new SocketIOFileUploadServer();
		siofuServer.on("saved", function (event) {
			console.log(event.file);
			event.file.clientDetail.base = event.file.base;
		});
		siofuServer.on("error", function (data) {
			console.log("Error: " + data.memo);
			console.log(data.error);
		});
		siofuServer.on("start", function (event) {
			if (/\.exe$/.test(event.file.name)) {
				console.log("Aborting: " + event.file.id);
				siofuServer.abort(event.file.id, socket);
			}
		});
		siofuServer.dir = "uploads";
		siofuServer.maxFileSize = 3000000;
		siofuServer.listen(socket);
	});
})