/* eslint-env amd, jquery */
/* eslint-disable no-console */
/* global requirejs */

requirejs.config({
	paths: {
		"SocketIOFileUpload": "/siofu/client",
		"socket.io": "/socket.io/socket.io"
	}
});

require(["socket.io", "SocketIOFileUpload"], function (io, SocketIOFileUpload) {

	var message = document.getElementById('message'),
      handle = document.getElementById('handle'),
      btn = document.getElementById('send'),
      output = document.getElementById('output');


	// non-jQuery version
	// eslint-disable-next-line no-redeclare
	function flash(message){
		(function(message){
			var flsh = document.createElement("div");
			flsh.setAttribute("class", "flash");
			flsh.textContent = message;
			document.body.appendChild(flsh);
			setTimeout(function(){
				document.body.removeChild(flsh);
			}, 10000);
		})(message);
	}

	var socket = io.connect();
	var uploader = new SocketIOFileUpload(socket);
	uploader.addEventListener("complete", function(event){
		console.log(event);
		flash("Upload Complete: "+event.file.name);
	});
	uploader.addEventListener("choose", function(event){
		flash("Files Chosen: "+event.files);
	});
	uploader.addEventListener("start", function(event){
		event.file.meta.hello = "World";
	});
	uploader.addEventListener("progress", function(event){
		console.log(event);
		console.log("File is", event.bytesLoaded/event.file.size*100, "percent loaded");
	});
	uploader.addEventListener("load", function(event){
		flash("File Loaded: "+event.file.name);
		console.log(event);
	});
	uploader.addEventListener("error", function(event){
		flash("Error: "+event.message);
		console.log(event.message);
		if (event.code === 1) {
			alert("Don't upload such a big file");
		}
	});
	uploader.maxFileSize = 3000000; // 30 Megabyte
	uploader.useBuffer = true;
	uploader.chunkSize = 1024;
	//uploader.useText = true;
	//uploader.serializedOctets = true;
	// document.getElementById("ul_btn").addEventListener("click", function(){
	// 	uploader.prompt();
	// }, false);

	btn.addEventListener('click', function(){
		socket.emit('publicChat', {
			message: message.value,
			handle: handle.value
		})
		message.value = "";
	});
	

	socket.on('publicChat', function(data){
    output.innerHTML += '<p><strong>' + data.handle + ': </strong>' + data.message + '</p>';
	});

	uploader.listenOnInput(document.getElementById("plain_input_element"));
	// uploader.listenOnDrop(document.getElementById("file_drop"));

	window.uploader = uploader;
});