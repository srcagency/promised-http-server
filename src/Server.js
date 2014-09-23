'use strict';

var http = require('http');
var fs = require('fs');
var extend = require('extend');
var Promise = require('bluebird');
var debug = require('debug')('promised-http-server');
var HttpError = require('./Error');
var send = require('./send');

module.exports = extend(Server, {
	send: send,
	Error: HttpError,
});

Server.prototype = extend(Object.create(http.Server.prototype), {
	listening: listening,
	handleRequest: handleRequest,
	handleResult: handleResult,
	handleHttpError: handleHttpError,
	handleFatalError: handleFatalError,
});

function Server( handler, listen ){
	if (!(this instanceof Server))
		return new Server();

	http.Server.call(this);

	this.requestCount = 0;

	this.on('listening', onListening.bind(this));
	this.on('request', onRequest.bind(this));
	this.on('error', onError.bind(this));
	this.on('close', onClose.bind(this));

	if (handler)
		this.handleRequest = handler;

	if (listen)
		this.listen(listen);
}

function listening(){
	if (this.open)
		return Promise.resolve(getAddress.call(this));

	var server = this;

	return new Promise(function( resolve ){
		server.once('listening', function(){
			resolve(getAddress.call(server));
		});
	});
}

function handleRequest(){
	throw HttpError(404);
}

function handleResult( result ){
	return send(this.request, this.response, result);
}

function handleHttpError( e ){
	debug('Request #%s raised HttpError (%d): %s', this.id, e.code, e);

	e.send(this.request, this.response);
}

function handleFatalError( e ){
	debug('Request #%s raised fatal error: %s', this.id, e.message);

	if (!this.response.headersSent)
		HttpError(500, 'Internal server error. Appropriate staff has been notified.')
			.send(this.request, this.response);

	throw e;
}

function onListening(){
	debug('Started http server (listening on: %s)', getAddress.call(this));

	if (isSocket(this.address()))
		fs.chmodSync(this.address(), '0777');

	this.open = true;
}

function onClose(){
	debug('Stopped http server');

	this.open = false;
}

function onRequest( request, response ){
	var id = this.requestCount++;

	debug('Request #%s serving %s: %s', id, request.method, request.url);

	Promise
		.bind({
			id: id,
			request: request,
			response: response,
			server: this,
			hrtime: debug.enabled && process.hrtime(),
		})
		.then(this.handleRequest)
		.then(this.handleResult)
		.catch(HttpError, this.handleHttpError)
		.catch(this.handleFatalError)
		.finally(endRequest);
}

function onError( e ){
	debug('Failed to start http server', e);

	if (e.code === 'EADDRINUSE' && isSocket(this.address())) {
		debug('Socket path existed');
		fs.unlinkSync(this.address());
		this.listen(this.address());
	}
}

function endRequest(){
	this.response.end();

	if (debug.enabled) {
		var diff = process.hrtime(this.hrtime);
		debug('Request #%s took %dms', this.id, (diff[0] * 1e9 + diff[1]) / 1e6);
	}
}

function getAddress(){
	var address = this.address();

	if (isSocket(address))
		return address;
	else
		return 'http://' + [ address.address, address.port ].join(':');
}

function isPort( port ){
	var portn = parseInt(port, 10);
	return portn === port && portn >= 0 && portn <= 65535;
}

function isSocket( socket ){
	return !isPort(socket) && typeof socket === 'string';
}