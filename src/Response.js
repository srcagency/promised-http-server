'use strict';

var http = require('http');
var send = require('./send');

module.exports = HttpResponse;

function HttpResponse( code, body ){
	if (!(this instanceof HttpResponse))
		return new HttpResponse(code, body);

	this.code = code;
	this.body = body;
}

HttpResponse.prototype.send = function( request, response ){
	return send(request, response, this.body, this.code);
};
