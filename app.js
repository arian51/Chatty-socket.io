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
	request = require("request"),
	bodyParser = require('body-parser'),
	querystring = require('querystring');    

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
	const privatechat = db.collection('privatechats');
	const usernames = db.collection('usernames');

	//------------EXPRESS CONFIGURATION------------//
	var urlencodedParser = bodyParser.urlencoded({ extended: false })

	app = express()
		.use(SocketIOFileUploadServer.router)
		.use(express.static(__dirname + "/out"))
		.use(express.static(__dirname + "/public_html"))
		.use("/scripts", express.static(__dirname + '/public_html/javascripts'))
		.get('/chat', (req, res) => {
			res.sendFile(__dirname + '/public_html/chat.html')
		})	//------------GET USER NAME------------//
		.post('/', urlencodedParser, function (req, res) {
			usernames.find({ username: req.body.username }).toArray(function (err, res) {
				if (_.isEmpty(res)) {
					usernames.insertOne({ username: req.body.username, userId: 0 });
				}
			})

			const query = querystring.stringify({
				"valid": req.body.username
			});

			console.log(req.body.username);
			res.redirect(`/chat.html/` + query);
		})
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
			let username = data.username;
			var userId = data.userId;

			usernames.find({ username: username }).toArray(function (err, res) {
				console.log(res);
				if (_.isEmpty(res)) {
					usernames.insertOne({ username: username, userId: userId });
				} else {
					usernames.updateOne({ username: res[0].username }, { $set: { userId: userId } });
				}
			})
		});

		// Send private message from one user to another 
		socket.on('privateChat', function (data) {
			let from = data;
			let user = data.username;
			let message = data.message;
			let file = data.file;
			let toUser = '';

			// Upload file to server (private)
			var siofuServer = new SocketIOFileUploadServer();
			siofuServer.on("saved", function (event) {
				console.log(event.file);
				event.file.clientDetail.base = event.file.base;
				console.log(event.file.pathName);
				var fileAddress = event.file.pathName;
				uploadFile(fileAddress, 'uploadFilePrivate', from);
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

			usernames.find({ username: user }).toArray(function (err, res) {
				console.log('res is' + JSON.stringify(res))
				if (_.isEmpty(res) === false) {
					console.log('id is' + res[0].userId)
					toUser = res[0].userId;
					io.to(`${toUser}`).emit('privateChat', data);
				} else {
					console.log("user doesn't exist");
				}
			});
		})

		// Send public messages 
		socket.on('publicChat', function (data) {
			let from = data;
			let name = data.handle
			let message = data.message
			let room = data.room
			let file = data.file

			// Upload file to server (Public)
			var siofuServer = new SocketIOFileUploadServer();
			siofuServer.on("saved", function (event) {
				console.log(event.file);
				event.file.clientDetail.base = event.file.base;
				console.log(event.file.pathName);
				var fileAddress = event.file.pathName;
				uploadFile(fileAddress, 'uploadFilePublic', from);

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

		if (to === 'uploadFilePublic') {	// upload to public room
			data.username = from.handle;
			data.message = from.message;
			data.room = from.room;
			data.link = link;

			io.sockets.emit(to, data);
			chat.insert({ handle: from.handle, message: from.message, room: from.room, file: link })
		} else {						// upload as private chat message
			data.username = from.username;
			data.fromUsername = '';
			data.message = from.message;
			data.link = link;

			usernames.find({ username: data.username }).toArray(function (err, res) {
				if (_.isEmpty(res) === false) {
					console.log('id is' + res[0].userId)
					toUser = res[0].userId;
					io.to(`${toUser}`).emit('uploadFilePrivate', data);
				} else {
					console.log("user doesn't exist");
				}
			});
		}
	}
})