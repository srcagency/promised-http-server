'use strict';

var http = require('http');
var util = require('util');
var fs = require('fs');

var Promise = require('bluebird');
var debug = require('debug')('http/Server');

var HttpError = require('./Error');

module.exports = Server;

Server.prototype.handleRequest = handleRequest;
Server.prototype.handleHttpError = handleHttpError;
Server.prototype.handleFatalError = handleFatalError;

Server.send = send;

function Server( listen, options ){
	if (!(this instanceof Server))
		return new Server(listen, options);

	this.retries = 1;
	this.count = 0;
	this.router = options && options.router;
	this.listen = listen;

	this.server = http
		.createServer()
		.on('request', onRequest.bind(this))
		.on('listening', onListening.bind(this))
		.on('error', onError.bind(this))
		.listen(listen);
}

function onError( e ){
	debug('Failed to start http server', e);

	if (e.code === 'EADDRINUSE' && !isPort(this.listen)) {
		debug('Address was in use');

		if (this.retries) {
			this.retries--;

			debug('Retrying (%d)', this.retries);
			fs.unlinkSync(this.listen);
			this.server.listen(this.listen);
		}
	}
}

function onListening( e ) {
	debug(e
		? 'Error starting server (listening on: %s)'
		: 'Started http server (listening on: ' + (isPort(this.listen) ? 'http://localhost:%s' : '%s') + ')'
	, this.listen);

	if (!e && !isPort(this.listen))
		fs.chmodSync(this.listen, '0777');
}

function onRequest( request, response ){
	var id = this.count++;

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
		.catch(HttpError, this.handleHttpError)
		.catch(this.handleFatalError)
		.finally(endRequest);
}

function handleRequest(){
	var route = this.server.router(this.request);

	if (route)
		return route.call(this, this.request, this.response);

	throw HttpError(404);
}

function handleHttpError( e ){
	debug('Request #%s raised HttpError (%d): %s', this.id, e.code, e);
	e.send(this.response);
}

function handleFatalError( e ){
	debug('Request #%s raised fatal error: %s', this.id, e.message);

	// @todo intense logging

	HttpError(500, 'Internal server error. Appropriate staff has been notified.').send(this.response);

	// rethrow to make it appear in stdout
	throw e;
}

function endRequest(){
	this.response.end();

	if (debug.enabled) {
		var diff = process.hrtime(this.hrtime);
		debug('Request #%s took %dms', this.id, (diff[0] * 1e9 + diff[1]) / 1e6);
	}
}

function send( request, response, data, code ){
	return Promise
		.cast(data)
		.then(function(data){
			if (typeof data !== 'string') {
				var accept = request.headers.accept;

				if (accept && accept.match(/json/i)) {
					response.writeHead(code || 200, { 'Content-Type': 'application/json; charset=utf-8' });
					response.end(JSON.stringify(data));
				} else {
					response.writeHead(code || 200, { 'Content-Type': 'text/plain; charset=utf-8' });
					response.end(JSON.stringify(data, null, '\t'));
				}
			} else {
				response.setHeader('Content-Type', 'text/html; charset=utf-8');
				response.end(data);
			}
		});
}

function isPort( port ) {
	// TODO: check in valid port range
	return parseInt(port, 10) === port;
}