# Promised http server

## Install

```shell
npm install
```

## Use

```js
var server = new HttpServer([ handler[, listen ]]);
```

Where `handler` (optional) is a function to handle requests

`listen` (optional) will be passed on to
[http.Server.listen](http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback)

By default the server will respond with 404 on all requests and won't
listen anywhere

```js
server.listen(listen);
```

See [http.Server.listen](http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback)

```js
server.listening();
```

Returns a promise which is resolved with the address listened on

```js
server.handleRequest = fn;
server.handleResult = fn;
server.handleHttpError = fn;
server.handleFatalError = fn;
```

Where `fn` is a function

All handlers have default implementations and they are listed here in
the same order as they are called during a request

A handler can return a promise which will then be resolved before
passed to the next handler

`handleRequest` will be called with arguments `request, response, id`

All other handlers will be called with a context of the format:

```js
{
	id: Integer,					// unique request id
	request: http.ClientRequest,	// request object
	response: http.ServerResponse,	// response object
}
```

`handleResult` will be called with whatever `handleRequest` returned. The
default implementation handles HttpResponse and HttpError correctly and casts
everything else to a string before sending it to the client.

`handleHttpError` receives any thrown `HttpError` while `handleFatalError` receives
any other error.

### Example

```js
var HttpServer = require('promised-http-server');
var HttpError = HttpServer.Error;

new HttpServer(function(){
	if (this.request.url === '/things') {
		switch (this.request.method) {
			case 'POST':
				return saveThingFromRequest(this.request)
					.return(HttpResponse(204));
			case 'PUT':
				return Promise
					.resolve(someAsyncStuff)
					.return({ saved: true });
			case 'GET':
				return { things: [] };
			default:
				throw HttpError(501); // not implemented
		}
	} else {
		throw HttpError(404);
	}
}, 80);
```

### For tests

In a test you might do something along the lines of this

```js
var tap = require('tap');

var server = require('../src');
server.listen(0);

tap.on('end', function(){
	server.close();
});

var address = server.listening();

address
	.then(function( addr ){
		// ready to test the server at `addr`
	});
```
