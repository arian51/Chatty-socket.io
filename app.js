var http = require("http"),
	url = require("url"),
	path = require("path"),
	mime = require("mime"),
	fs = require("fs"),
	SocketIOFileUploadServer = require("./server.js"),
	socketio = require("socket.io"),
	express = require("express"),
	mongo = require('mongodb').MongoClient,
	_ = require('lodash'),
	request = require("request"),
	bodyParser = require('body-parser'),
	querystring = require('querystring');

var app, io;
var siofuServer = new SocketIOFileUploadServer();


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
	const privatechat = db.collection('privatechats');
	const usernames = db.collection('usernames');

	//------------EXPRESS CONFIGURATION------------//
	var urlencodedParser = bodyParser.urlencoded({ extended: false })

	app = express()
		.use(SocketIOFileUploadServer.router)
		.use(express.static(__dirname + "/out"))
		.use(express.static(__dirname + "/public_html"))
		.post('/', urlencodedParser, function (req, res) {
			usernames.find({ username: req.body.username }).toArray(function (err, res) {
				if (_.isEmpty(res)) {
					usernames.insertOne({ username: req.body.username, userId: 0 });
				}
			})

			const query = querystring.stringify({
				"username": req.body.username
			});

			res.redirect(`/chat?` + query);
		})
		.get('/chat?:username', (req, res) => {
			res.sendFile(__dirname + '/public_html/chat.html')
		})
		.listen(4567);
	io = socketio.listen(app);

	console.log("Listening on port 4567");


	//------------ON USER CONNECTION------------//
	io.sockets.on("connection", function (socket) {
		console.log('made socket connection', socket.id);

		// Find username and set it's userID to socket.ID. exp: Arian => 423Px3
		socket.on('getUsername', function (username) {
			usernames.find({ username: username }).toArray(function (err, res) {
				if (_.isEmpty(res)) {
					usernames.insertOne({ username: username, userId: socket.id });
				} else {
					usernames.updateOne({ username: res[0].username }, { $set: { userId: socket.id } })
				}
			})

			// Get chat messages from mongo collection (Private)
			privatechat.find({toUser: username}).toArray(function (err, res) {
				for (var message of res) {
					socket.emit('privateChat', message);
				}
			})
		})

		// Get chat messages from mongo collection (Public)
		chat.find().limit(100).sort({ _id: 1 }).toArray(function (err, res) {
			for (var message of res) {
				socket.emit('publicChat', message);
			}
		})

		// Get chat messages that belong the specefic rooms
		socket.on('getChat', function (data) {
			let room = data.room

			chat.find({ room: room }).limit(100).sort({ _id: 1 }).toArray(function (err, res) {
				for (var message of res) {
					socket.emit('getChat', message);
				}
			})
		});

		// Send private message from one user to another 
		socket.on('privateChat', function (data) {
			let from = data;
			let fromUser = data.fromUser;
			let toUser = data.toUser;
			let toUsername = data.toUser;
			let message = data.message;
			let file = data.file;
			let count = 0;

			// Upload file to server (private)
			if (file) {
				uploadToSystem(from, 'uploadFilePrivate');
			}

			if (file === "") {
				usernames.find({ username: toUser }).toArray(function (err, res) {
					if (_.isEmpty(res) === false) {
						toUser = res[0].userId;
						io.to(`${toUser}`).emit('privateChat', from);
						privatechat.insertOne({ fromUser: fromUser, toUser: toUsername, message: message, link: null })
					} else {
						console.log("user doesn't exist");
					}
				});
			}
		})

		// Send public messages 
		socket.on('publicChat', function (data) {
			let from = data;
			let name = data.handle
			let message = data.message
			let room = data.room
			let file = data.file

			if (file) {
				uploadToSystem(from, 'uploadFilePublic');
			}

			if (name != '' && message != '' && room != '' && file === "") {
				io.sockets.emit('publicChat', data);
				chat.insert({ handle: name, message: message, room: room })
			}
		});

		function uploadToSystem(from, toSocket) {
			siofuServer.from = from;
			siofuServer.on("saved", function (event) {
				console.log(siofuServer.from);
				event.file.clientDetail.base = event.file.base;
				fileAddress = event.file.pathName;
				uploadFile(fileAddress, toSocket, siofuServer.from);
				siofuServer = new SocketIOFileUploadServer();
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
		}

	});

	//------------A FUNCTION FOR SENDING FILE TO EXTERNAL DATABASE------------//
	function uploadFile(fileAddress, to, from) {

		var fileAddress2 = fileAddress.replace(/\\/g, "/");

		var str = fileAddress2;
		var n = str.lastIndexOf('/');
		var fileName = str.substring(n + 1);

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

			sendBack(to, body, from);
		})
	}

	function sendBack(to, link, from) {
		console.log('this part => ' + link)
		let data = {};

		if (to === 'uploadFilePublic') {	// upload to public room
			data.username = from.handle;
			data.message = from.message;
			data.room = from.room;
			data.link = link;
			io.sockets.emit(to, data);
			chat.insert({ handle: from.handle, message: from.message, room: from.room, file: link })
		} else {						// upload as private chat message
			data.username = from.toUser;
			data.fromUsername = from.fromUser;
			data.message = from.message;
			data.link = link;

			usernames.find({ username: data.username }).toArray(function (err, res) {
				if (_.isEmpty(res) === false) {
					toUser = res[0].userId;
					io.to(`${toUser}`).emit('uploadFilePrivate', data);
					privatechat.insertOne({ fromUser: data.fromUsername, toUser: from.toUser, message: from.message, link: link })
				} else {
					console.log("user doesn't exist");
				}
			});
		}
	}
})