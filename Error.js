'use strict';

var http = require('http');

module.exports = HttpError;

function HttpError( statusCode, message ){
	if (!(this instanceof HttpError))
		return new HttpError(statusCode, message);

	if (typeof statusCode !== 'number') {
		this.message = statusCode;
		this.code = 500;
	} else {
		this.message = message || http.STATUS_CODES[statusCode];
		this.code = statusCode;
	}
}

HttpError.prototype = Object.create(Error.prototype);

HttpError.prototype.send = function( response ){
	response.writeHead(this.code, this.message);
	response.end();
};