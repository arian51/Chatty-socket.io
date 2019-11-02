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
const mongoUrl = 'mongodb://localhost:27017';

const dbToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1bmlxdWVfbmFtZSI6ImFyaWFua2hlaWJhcmlAZ21haWwuY29tIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy91c2VyZGF0YSI6IjMxMjU4IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy92ZXJzaW9uIjoiMiIsImlzcyI6Imh0dHA6Ly9hcGkucGFyc2FzcGFjZS5jb20vIiwiYXVkIjoiQW55IiwiZXhwIjoxNjA0MTc0MzE2LCJuYmYiOjE1NzI2MzgzMTZ9.4WurKjeKq6Vj9xhabKQvDdL7ng7h8069wLAx6v80HWA';
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
	let Chat = db.collection('chats');

	io.sockets.on("connection", function (socket) {

		console.log('made socket connection', socket.id);

		// Set socket id

		var userNames = {};
		socket.on('setSocketId', function (data) {
			var userName = data.myUserName;
			var userId = data.userId;
			userNames[userName] = userId;
		});

		// Private Chat 

		socket.on('privateChat', function (data) {
			user = data.usernsame;
			message = data.message;
			console.log(data)
			io.to(`${userNames[user]}`).emit('privateChat', message);
		})

		// Get chat from mongo collection
		Chat.find().limit(100).sort({ _id: 1 }).toArray(function (err, res) {
			for (var message of res) {
				socket.emit('publicChat', message);
			}
		})

		socket.on('getChat', function (data) {
			let room = data.room

			Chat.find({ room: room }).limit(100).sort({ _id: 1 }).toArray(function (err, res) {
				console.log(res);
				for (var message of res) {
					socket.emit('getChat', message);
				}
			})
		});

		// Handle chat event
		socket.on('publicChat', function (data) {
			let name = data.handle
			let message = data.message
			let room = data.room
			
			console.log(data);
			if (name != '' && message != '' && room != '') {
				io.sockets.emit('publicChat', data);
				Chat.insert({ handle: name, message: message, room: room })
			}
		});

		var siofuServer = new SocketIOFileUploadServer();
		siofuServer.on("saved", function (event) {
			console.log(event.file);
			event.file.clientDetail.base = event.file.base;
			console.log(event.file.pathName);
			var fileAddress = event.file.pathName;
			uploadFile(fileAddress);
			
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

	// var options = { method: 'POST',
	// url: 'http://api.parsaspace.com/v1/files/upload',
	// headers:
	// {    
	//  'content-type': 'multipart/form-data; boundary=---011000010111000001101001',
	//   authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1bmlxdWVfbmFtZSI6ImFyaWFua2hlaWJhcmlAZ21haWwuY29tIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy91c2VyZGF0YSI6IjMxMjU4IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy92ZXJzaW9uIjoiMiIsImlzcyI6Imh0dHA6Ly9hcGkucGFyc2FzcGFjZS5jb20vIiwiYXVkIjoiQW55IiwiZXhwIjoxNjA0MTc5MzE2LCJuYmYiOjE1NzI2NDMzMTZ9.0WfsPuI5CztCx1IpUoMqCVaorXosNFTuvcJlWpenvvI'},
	//   formData:{ file: { value: fs.createReadStream('C:/Users/Arian/Desktop/photo_2019-10-07_18-37-35.jpg') ,options:{ filename: 'photo_2019-10-07_18-37-35.jpg',contentType: null } }, domain: 'myprivatesubdomain.parsaspace.com', path: '/' } };

	//   request(options, function (error, response, body) {
	//   if (error) throw new Error(error);

	//   console.log(body);
	//    })

})

function uploadFile(fileAddress) {

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

	request(options, function (error, response, body) {
		if (error) throw new Error(error);

		console.log(body);
	})
}