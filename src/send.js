'use strict'

var http = require('http');

module.exports = send;

var json = { 'Content-Type': 'application/json; charset=utf-8' };
var plain = { 'Content-Type': 'text/plan; charset=utf-8' };

function send( request, response, data, code, reason ){
	var headers;
	var accept = request.headers.accept;

	code = code || response.statusCode;
	reason = reason || http.STATUS_CODES[code];

	if (accept && accept.indexOf('json'))
		headers = json;
	else
		headers = plain;

	response.writeHead(code, reason, headers);
	response.end(JSON.stringify(data, null, '\t'));
}
