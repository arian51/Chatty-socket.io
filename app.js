var http = require("http"),
	url = require("url"),
	path = require("path"),
	mime = require("mime"),
	fs = require("fs"),
	SocketIOFileUploadServer = require("../server"),
	socketio = require("socket.io"),
	express = require("express"),
	mongo = require('mongodb').MongoClient,
	_ = require('lodash'),
	request = require("request");

var app, io;

//------------DATABASE------------//
const mongoUrl = 'mongodb://localhost:27017';

mongo.connect(mongoUrl, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
}, (err, client) => {
	if (err) {
		console.error(err);
		return;
	}

	//------------DATABASE CONFIGURATION------------//
	const db = client.db('mongoChat')
	const chat = db.collection('chats');
	const usernames = db.collection('usernames');

	//------------EXPRESS CONFIGURATION------------//
	app = express()
		.use(SocketIOFileUploadServer.router)
		.use(express.static(__dirname + "/out"))
		.use(express.static(__dirname + "/public_html"))
		.listen(4567);
	io = socketio.listen(app);

	console.log("Listening on port 4567");


	//------------ON USER CONNECTION------------//
	io.sockets.on("connection", function (socket) {
		console.log('made socket connection', socket.id);

		// Get chat messages from mongo collection
		chat.find().limit(100).sort({ _id: 1 }).toArray(function (err, res) {
			for (var message of res) {
				socket.emit('publicChat', message);
			}
		})

		// Get chat messages that belong the same rooms
		socket.on('getChat', function (data) {
			let room = data.room

			chat.find({ room: room }).limit(100).sort({ _id: 1 }).toArray(function (err, res) {
				console.log(res);
				for (var message of res) {
					socket.emit('getChat', message);
				}
			})
		});

		// Get the id of each user from client side and equal them to their user name. exp: Arian : 14xz54
		const userNames = {};	// Change it so we can store usernames in the database 
		socket.on('setSocketId', function (data) {	// Each time the program starts userNames will be equal to {}
			var userName = data.userName;
			console.log('username is ' + JSON.stringify(userName))
			var userId = data.userId;
			userNames[userName] = userId;
		});

		// Send private message from one user to another 
		socket.on('privateChat', function (data) {
			user = data.username;
			message = data.message;
			console.log(user)
			console.log(userNames)
			console.log(data)
			io.to(`${userNames[user]}`).emit('privateChat', data);
		})

		// Send public messages 
		socket.on('publicChat', function (data) {
			let from = data;
			let name = data.handle
			let message = data.message
			let room = data.room
			let file = data.file 

			// Upload file to server
			var siofuServer = new SocketIOFileUploadServer();
			siofuServer.on("saved", function (event) {
				console.log(event.file);
				event.file.clientDetail.base = event.file.base;
				console.log(event.file.pathName);
				var fileAddress = event.file.pathName;
				uploadFile(fileAddress, 'file', from);

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

			console.log(data);
			if (name != '' && message != '' && room != '' && file === "") {
				io.sockets.emit('publicChat', data);
				chat.insert({ handle: name, message: message, room: room })
			}
		});

		// Upload files to database
	});

	//------------A FUNCTION FOR SENDING FILE TO EXTERNAL DATABASE------------//
	function uploadFile(fileAddress, to, from) {

		var fileAddress2 = fileAddress.replace(/\\/g, "/");

		var str = fileAddress2;
		var n = str.lastIndexOf('/');
		var fileName = str.substring(n + 1);

		console.log(fileAddress2)
		var options = {
			method: 'POST',
			url: 'http://api.parsaspace.com/v1/files/upload',
			headers:
			{
				'content-type': 'multipart/form-data; boundary=---011000010111000001101001',
				authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1bmlxdWVfbmFtZSI6ImFyaWFua2hlaWJhcmlAZ21haWwuY29tIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy91c2VyZGF0YSI6IjMxMjU4IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy92ZXJzaW9uIjoiMiIsImlzcyI6Imh0dHA6Ly9hcGkucGFyc2FzcGFjZS5jb20vIiwiYXVkIjoiQW55IiwiZXhwIjoxNjA0MTc5MzE2LCJuYmYiOjE1NzI2NDMzMTZ9.0WfsPuI5CztCx1IpUoMqCVaorXosNFTuvcJlWpenvvI'
			},
			formData: { file: { value: fs.createReadStream(fileAddress2), options: { filename: fileName, contentType: null } }, domain: 'myprivatesubdomain.parsaspace.com', path: '/' }
		};

		return request(options, function (error, response, body) {
			if (error) throw new Error(error);

			console.log(body);
			sendBack(to, body, from);
		})
	}

	function sendBack(to, link, from) {
		console.log('this part => ' + link)
		let data = {};
		data.username = from.handle;
		data.message = from.message; 
		data.room = from.room;
		data.link = link;
		io.sockets.emit('file', data);
		chat.insert({ handle: from.handle, message: from.message, room: from.room, file: link})
	}
})