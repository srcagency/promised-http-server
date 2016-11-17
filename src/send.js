'use strict'

var http = require('http');
var JSONStream = require('JSONStream');
var ps = require('promise-streams');

module.exports = send;

var json = { 'Content-Type': 'application/json; charset=utf-8' };
var plain = { 'Content-Type': 'text/plain; charset=utf-8' };

function send( request, response, data, code, reason ){
	var headers;
	var accept = request.headers.accept;

	code = code || response.statusCode;
	reason = reason || http.STATUS_CODES[code];

	if (data === undefined)
		return response.writeHead(code, reason);

	if (accept !== undefined && accept.indexOf('json') !== -1)
		headers = json;
	else
		headers = plain;

	response.writeHead(code, reason, headers);

	if (data === null || typeof data.pipe !== 'function')
		return response.end(JSON.stringify(data, null, headers === json ? null : '\t'));

	return ps.wait(data
		.pipe(headers === json
			? JSONStream.stringify('[\n', ',\n', '\n]')
			: JSONStream.stringify('[\n', ',\n', '\n]', '\t'))
		.pipe(response));
}
