/* eslint-env amd, jquery */
/* eslint-disable no-console */
/* global requirejs */

//------------ADDING REQUIERD FILES TO CLIENT-SIDE JS------------//
requirejs.config({
	paths: {
		"SocketIOFileUpload": "/siofu/client",
		"socket.io": "/socket.io/socket.io"
	}
});

//------------RUN AFTER LOADING REQUIRMENTS------------//
require(["socket.io", "SocketIOFileUpload"], function (io, SocketIOFileUpload) {

	var message = document.getElementById('message'),
		handle = document.getElementById('handle'),
		btn = document.getElementById('send'),
		output = document.getElementById('output'),
		roomName = document.getElementById('room'),
		roomBtn = document.getElementById('enter-room'),

		myUserName = document.getElementById('my-username'),
		myUsrBtn = document.getElementById('submit-username'),

		toUsername = document.getElementById('username'),
		pvMessage = document.getElementById('pvMessage'),
		pvBtn = document.getElementById('send-private');

	// eslint-disable-next-line no-redeclare
	function flash(message) {
		(function (message) {
			var flsh = document.createElement("div");
			flsh.setAttribute("class", "flash");
			flsh.textContent = message;
			document.body.appendChild(flsh);
			setTimeout(function () {
				document.body.removeChild(flsh);
			}, 10000);
		})(message);
	}

	//------------GET USERNAME FOR PRIVATE CHAT------------//
	myUsrBtn.addEventListener('click', function () {
		console.log('your username has been set');
		data = { userName: myUserName, userId: socket.id };
		socket.emit('setSocketId', data);
	})

	//------------ENTERING A ROOM------------//
	roomBtn.addEventListener('click', function () {
		output.innerHTML = '';
		socket.emit('getChat', {
			room: roomName.options[roomName.selectedIndex].value
		})
	});

	//------------SEND USER MESSAGE TO SERVER SIDE (PUBLIC)------------//
	btn.addEventListener('click', function () {
		uploader = document.getElementById("plain_input_element");
		console.log(uploader);

		socket.emit('publicChat', {
			message: message.value,
			handle: handle.value,
			room: roomName.options[roomName.selectedIndex].value
		})
		message.value = "";
	});

	//------------SEND USER MESSAGE TO SERVER SIDE (PRIVATE)------------//
	pvBtn.addEventListener('click', function () {
		console.log('This part');
		socket.emit('privateChat', { username: toUsername.value, message: pvMessage.value })
	})


	//------------GET MESSAGES FROM SERVER (PUBLIC)------------//
	socket.on('publicChat', function (data) {
		console.log(data);
		if (data.room === roomName.options[roomName.selectedIndex].value) {
			output.innerHTML += '<p><strong>' + data.handle + ': </strong>' + data.message + '</p>';
		}
	});

	//------------GET MESSAGES FROM SERVER (PRIVATE)------------//
	socket.on('privateChat', function (data) {
		console.log(data);
		output.innerHTML += '<p>' + data + '</p>';
	});

	//------------GET MESSAGES FROM SERVER (CHATROOMS)------------//
	socket.on('getChat', function (data) {
		console.log(data);
		output.innerHTML += '<p><strong>' + data.handle + ': </strong>' + data.message + '</p>';
	});

	//-------------UPLOAD-------------//
	var socket = io.connect();
	var uploader = new SocketIOFileUpload(socket);
	uploader.addEventListener("complete", function (event) {
		console.log(event);
		flash("Upload Complete: " + event.file.name);
	});
	uploader.addEventListener("choose", function (event) {
		flash("Files Chosen: " + event.files);
	});
	uploader.addEventListener("start", function (event) {
		event.file.meta.hello = "World";
	});
	uploader.addEventListener("progress", function (event) {
		console.log(event);
		console.log("File is", event.bytesLoaded / event.file.size * 100, "percent loaded");
	});
	uploader.addEventListener("load", function (event) {
		flash("File Loaded: " + event.file.name);
		console.log(event);
	});
	uploader.addEventListener("error", function (event) {
		flash("Error: " + event.message);
		console.log(event.message);
		if (event.code === 1) {
			alert("Don't upload such a big file");
		}
	});
	uploader.maxFileSize = 3000000;
	uploader.useBuffer = true;
	uploader.chunkSize = 1024;

	window.uploader = uploader;
});