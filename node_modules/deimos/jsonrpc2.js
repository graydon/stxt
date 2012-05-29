////////////////////////////////////////////////////////////////////////////
// Copyright © 2011, Vinícius dos Santos Oliveira                         //
//                                                                        //
// All rights reserved.                                                   //
//                                                                        //
// Redistribution and use in source and binary forms, with or without     //
// modification, are permitted provided that the following conditions are //
// met:                                                                   //
//                                                                        //
//     * Redistributions of source code must retain the above copyright   //
//       notice, this list of conditions and the following disclaimer.    //
//                                                                        //
//     * Redistributions in binary form must reproduce the above          //
//       copyright notice, this list of conditions and the following      //
//       disclaimer in the documentation and/or other materials provided  //
//       with the distribution.                                           //
//                                                                        //
//     * Neither the name of the Massachusetts Institute of Technology    //
//       nor the names of its contributors may be used to endorse or      //
//       promote products derived from this software without specific     //
//       prior written permission.                                        //
//                                                                        //
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS    //
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT      //
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR  //
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT   //
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,  //
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT       //
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,  //
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY  //
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT    //
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE  //
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.   //
////////////////////////////////////////////////////////////////////////////
/*
 * JSON-RPC 1.0 and 2.0
 * http://groups.google.com/group/json-rpc/web/json-1-0-spec
 * http://groups.google.com/group/json-rpc/web/json-rpc-2-0
 * http://groups.google.com/group/json-rpc/web/json-rpc-over-http
 * 
 * Manages RPC-JSON messages
 * 
 * Sample usage:
 * 
 *     var http = require('http');
 *     var RpcHandler = require('jsonrpc2').RpcHandler;
 * 
 *     rpcMethods = {
 *         insert: function(rpc, args) {
 *             if (args[0] != args[1]) {
 *                 rpc.error('Params doesn\'t match!');
 *             } else {
 *                 rpc.response('Params are OK!');
 *             }
 *         }
 *     }
 *
 *     http.createServer(function (request, response) {
 *         if (request.method == 'POST') {
 *             new RpcHandler(request, response, rpcMethods, true);
 *         } else {
 *             response.end('Hello world!');
 *         }
 *     }).listen(80);
 * 
 * Sample message traffic:
 * 
 * --> {"jsonrpc": "2.0", "method": "insert", "params": ["value", "other"], "id": 1}
 * <-- {"jsonrpc": "2.0", "error": "Params doesn't match!", "id": 1}
 * 
 * --> {"jsonrpc": "2.0", "method": "insert", "params": ["value", "value"], "id": 2}
 * <-- {"jsonrpc": "2.0", "result": "Params are OK!", "id": 2}
 * 
 */

var isArray = require('./utils.js').isArray;

/**
 * new RpcHandler(request, response, methods, debug)
 * - request (Object): http.ServerRequest object
 * - response (Object): http.ServerResponse object
 * - methods (Object): available RPC methods. 
 *       methods = {insert: function(rpc, args){})
 * - debug (Boolean): If TRUE use actual error messages on runtime errors
 * 
 * Creates an RPC handler object which parses the input, forwards the data
 * to a RPC method and outputs response messages.
 */
function RpcHandler(request, response, methods, debug) {
    this.httpRequest = request;
    this.httpResponse = response;
    this.methods = methods;
    this.debug = !!debug;

    if (typeof this.methods == 'object' &&
        this.httpRequest && this.httpResponse) {
        this._handleRequest();
    } else  {
        throw new Error('Invalid params');
    }
}

exports.RpcHandler = RpcHandler;

//////////// PUBLIC METHODS ////////////

/**
 * RpcHandler.prototype.error = function(error) -> Boolean
 * - errorCode (int): Error code
 * - errorMessage (String): Error message
 * - httpStatus (int): HTTP status code for the response
 * - data: error custom data
 * 
 * Sends an error message if error occured.
 * Returns true if a message was sent and false if blank was sent
 */
RpcHandler.prototype.error = function(errorCode, errorMessage,
                                      httpStatus, data, forceOutput) {
    httpStatus = typeof(httpStatus) != 'undefined' ? httpStatus : 500;
    data = typeof(data) != 'undefined' ? data : null;
    forceOutput = !!forceOutput;

    if (!this.batch)
        this.httpResponse.writeHead(httpStatus,
                                    {"Content-Type": "application/json"});

    if (forceOutput ||
        ('id' in this && this.id !== null)) {
        var errObj = {
            "code": errorCode,
            "message": errorMessage
        };

        if (data !== null)
            errObj.data = data;

        var resObj = {"id": this.id};

        if (this.version == 2) {
            resObj.jsonrpc = '2.0';
            resObj.error = errObj;
        } else {
            resObj.error = JSON.stringify(errObj);
        }

        if (this.batch)
            this.responseObject.push(resObj);
        else
            this.httpResponse.write(JSON.stringify(resObj));
    }

    if (this.batch) {
        this.requestsNumber--;
        if (this.requestsNumber == 0) {
            this.httpResponse.writeHead(200,
                                        {"Content-Type": "application/json"});
            this.httpResponse.end(JSON.stringify(this.responseObject));
        }
    } else {
        this.httpResponse.end();
    }
}

RpcHandler.prototype.methodNotFound = function() {
    this.error(-32601, 'Method not found', 404);
}

RpcHandler.prototype.invalidParams = function() {
    this.error(-32602, 'Invalid params');
}

RpcHandler.prototype.internalError = function(data) {
    data = typeof(data) != 'undefined' ? data : null;
    this.error(-32603, 'Internal error', 500, data);
}

/**
 * RPCHandler.prototype.response = function(result) -> Boolean
 * - result (String): Response message
 * 
 * Sends the response message if everything was successful
 * Returns true if a message was sent and false if blank was sent
 */
RpcHandler.prototype.response = function(result) {
    if (!this.batch)
        this.httpResponse.writeHead(200,
                                    {"Content-Type": "application/json"});

    if ('id' in this && this.id !== null) {
        var resObj = {
            "id": this.id,
            "result": result
        };

        if (this.version == 2)
            resObj.jsonrpc = '2.0';

        if (this.batch)
            this.responseObject.push(resObj);
        else
            this.httpResponse.write(JSON.stringify(resObj));
    }

    if (this.batch) {
        this.requestsNumber--;
        if (this.requestsNumber == 0) {
            this.httpResponse.writeHead(200,
                                        {"Content-Type": "application/json"});
            this.httpResponse.end(JSON.stringify(this.responseObject));
        }
    } else {
        this.httpResponse.end();
    }
}

//////////// PRIVATE METHODS ////////////

RpcHandler.prototype._parseError = function() {
    this.error(-32700, 'Parse error', 500, null, true);
}

RpcHandler.prototype._invalidRequest = function() {
    this.error(-32600, 'Invalid Request', 400, null, true);
}

/**
 * RpcHandler._run(json) -> undefined
 * - json (Object): JSON object
 * 
 * Checks if input is correct and passes the params to an actual RPC method
 **/
RpcHandler.prototype._run = function(json) {
    if (!json.method)
        this._invalidRequest();

    if (!this.methods)
        this.methodNotFound();

    if (!(json.method in this.methods) ||
        typeof this.methods[json.method] != 'function')
        this.methodNotFound();

    var params = null;

    if ('params' in json) {
        if (typeof json.params == 'object') {
            params = json.params;
        } else {
            this._invalidRequest();
            return;
        }
    }

    try {
        this.methods[json.method](this, json.params);
    } catch(e) {
        this.internalError(this.debug ? e.message : null);
    }
}

/**
 * RpcHandler._handleRequest() -> undefined
 * 
 * Checks if request is valid and handles all errors
 */
RpcHandler.prototype._handleRequest = function() {
    this.httpRequest.setEncoding('utf8');
    var rpcHandler = this;
    this._handleRequestBody(function(object, err) {
        if (err) {
            rpcHandler._parseError();
            return;
        }

        var arrayObject;

        if (isArray(object)) {
            if (object.length == 0) {
                rpcHandler.batch = false;
                rpcHandler._invalidRequest();
                return;
            }

            rpcHandler.batch = true;
            rpcHandler.responseObject = [];
            arrayObject = object;
        } else {
            rpcHandler.batch = false;
            arrayObject = [object];
        }

        rpcHandler.requestsNumber = arrayObject.length;

        arrayObject.forEach(function(json) {
            if ('id' in json) {
                if (typeof json.id == 'string' ||
                    typeof json.id == 'number') {
                    rpcHandler.id = json.id;
                } else {
                    rpcHandler._invalidRequest();
                    return;
                }
            } else {
                delete rpcHandler.id;
            }

            if ('jsonrpc' in json) {
                if (json.jsonrpc != '2.0') {
                    rpcHandler._invalidRequest();
                    return;
                }

                rpcHandler.version = 2;
            } else {
                rpcHandler.version = 1;
            }

            rpcHandler._run(json);
        });
    });
}

// TODO: limit the maximum-size of the body
// add option to use a temporary file as buffer
/**
 * RpcHandler._handleRequestBody(callback) -> undefined
 * - callback (Function): callback function to be called with the complete body
 * 
 * Parses the request body into one larger string
 */
RpcHandler.prototype._handleRequestBody = function (callback) {
    var content = '';

    this.httpRequest.addListener('data', function(chunk){
        content += chunk;
    });

    this.httpRequest.addListener('end', function(){
        try {
            callback(JSON.parse(content), null);
        } catch(e) {
            callback(null, e);
        }
    });
}
