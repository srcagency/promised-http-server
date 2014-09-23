'use strict';

var http = require('http');
var send = require('./send');

module.exports = HttpError;

function HttpError( statusCode, message, body ){
	if (!(this instanceof HttpError))
		return new HttpError(statusCode, message);

	if (typeof statusCode !== 'number') {
		this.message = statusCode;
		this.code = 500;
	} else {
		this.message = message || http.STATUS_CODES[statusCode];
		this.code = statusCode;
	}

	this.body = body;
}

HttpError.prototype = Object.create(Error.prototype);

HttpError.prototype.send = function( request, response ){
	return send(request, response, this.body, this.code, this.message);
};
