'use strict'

var http = require('http');
var JSONStream = require('JSONStream');
var ps = require('promise-streams');

module.exports = send;

var plain = { 'Content-Type': 'text/plain; charset=utf-8' };
var json = { 'Content-Type': 'application/json; charset=utf-8' };
var jsonl = { 'Content-Type': 'application/jsonl; charset=utf-8' };
var ndjson = { 'Content-Type': 'application/x-ndjson; charset=utf-8' };

function send( request, response, data, code, reason ){
	var headers;
	var accept = request.headers.accept;

	code = code || response.statusCode;
	reason = reason || http.STATUS_CODES[code];

	if (data === undefined)
		return response.writeHead(code, reason);

	if (accept !== undefined) {
		if (accept.indexOf('jsonl') !== -1)
			headers = jsonl
		else if (accept.indexOf('ndjson') !== -1)
			headers = ndjson
		else if (accept.indexOf('json') !== -1)
			headers = json;
		else
			headers = plain;
	} else {
		headers = plain;
	}

	response.writeHead(code, reason, headers);

	if (data === null || typeof data.pipe !== 'function')
		return response.end(JSON.stringify(
			data,
			null,
			headers === json || headers === jsonl || headers === ndjson ? null : '\t'
		));

	return ps.wait(data
		.pipe(headers === jsonl || headers === ndjson
			? JSONStream.stringify(false)
			: headers === json
			? JSONStream.stringify('[\n', ',\n', '\n]')
			: JSONStream.stringify('', '\n', '\n', '\t'))
		.pipe(response));
}
