'use strict';

var http = require('http');
var fs = require('fs');
var assign = require('object-assign');
var Promise = require('bluebird');
var debug = require('debug')('promised-http-server');
var isInteger = require('is-integer');
var HttpError = require('./Error');
var HttpResponse = require('./Response');
var send = require('./send');

module.exports = assign(Server, {
	send: send,
	Error: HttpError,
	Response: HttpResponse,
});

Server.prototype = assign(Object.create(http.Server.prototype), {
	count: 0,
	listen: listen,
	listening: listening,
	handleRequest: handleRequest,
	handleResult: handleResult,
	handleHttpError: handleHttpError,
	handleFatalError: handleFatalError,
});

function Server( handler, endpoint ){
	if (!(this instanceof Server))
		return new Server(handler, endpoint);

	http.Server.call(this);

	var server = this;

	this.on('listening', function(){
		onListening(server);
	});

	this.on('request', function( request, response ){
		onRequest(server, request, response);
	});

	this.on('error', function( e ){
		onError(server, e);
	});

	this.on('close', function(){
		onClose(server);
	});

	if (handler)
		this.handleRequest = handler;

	if (endpoint)
		this.listen(endpoint);
}

function listen( endpoint ){
	this.endpoint = endpoint;

	http.Server.prototype.listen.call(this, endpoint);

	return this.listening();
}

function listening(){
	if (this.open)
		return Promise.resolve(getAddress(this));

	var server = this;

	return new Promise(function( resolve ){
		server.once('listening', function(){
			resolve(getAddress(server));
		});
	});
}

function handleRequest(){
	throw HttpError(404);
}

function handleResult( result ){
	if (result !== undefined) {
		if (result instanceof HttpResponse)
			return result.send(this.request, this.response);

		if (result instanceof HttpError)
			return handleHttpError.call(this, result);

		return send(this.request, this.response, result);
	}
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

function onListening( server ){
	debug('Started http server (listening on: %s)', getAddress(server));

	if (isSocket(server.endpoint))
		fs.chmodSync(server.endpoint, '0777');

	server.open = true;
}

function onClose( server ){
	debug('Stopped http server');

	server.open = false;
}

function onRequest( server, request, response ){
	var id = server.count++;

	debug('Request #%s serving %s: %s', id, request.method, request.url);

	Promise
		.bind({
			id: id,
			request: request,
			response: response,
			server: server,
			hrtime: debug.enabled && process.hrtime(),
		})
		.then(server.handleRequest)
		.then(server.handleResult)
		.catch(HttpError, server.handleHttpError)
		.catch(server.handleFatalError)
		.finally(endRequest);
}

function onError( server, e ){
	if (e.code === 'EADDRINUSE')
		throw new Error((isSocket(server.endpoint) ? 'Socket' : 'Port') + ' in use');

	throw e;
}

function endRequest(){
	this.response.end();

	if (debug.enabled) {
		var diff = process.hrtime(this.hrtime);
		debug('Request #%s took %dms', this.id, (diff[0] * 1e9 + diff[1]) / 1e6);
	}
}

function getAddress( server ){
	var address = server.address();

	if (isSocket(address))
		return address;
	else
		return 'http://' + [
			address.address === '::'
				? 'localhost'
				: address.address,
			address.port
		].join(':');
}

function isPort( port ){
	port = parseInt(port, 10);
	return isInteger(port) && port >= 0 && port <= 65535;
}

function isSocket( socket ){
	return !isPort(socket) && typeof socket === 'string';
}
