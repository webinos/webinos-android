/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	 http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 ******************************************************************************/

(function () {
	var logger = console;

	/**
	 * Registry for service objects. Used by RPC.
	 * @constructor
	 * @alias Registry
	 * @param parent PZH (optional).
	 */
	var Registry = function(parent) {
		this.parent = parent;

		/**
		 * Holds registered Webinos Service objects local to this RPC.
		 *
		 * Service objects are stored in this dictionary with their API url as
		 * key.
		 */
		this.objects = {};
	};

	var _registerObject = function (callback) {
		if (!callback) {
			return;
		}
		logger.log("Adding: " + callback.api);

		var receiverObjs = this.objects[callback.api];
		if (!receiverObjs)
			receiverObjs = [];

		// generate id
		var md5sum = crypto.createHash('md5');
		callback.id = md5sum.update(callback.api + callback.displayName + callback.description).digest('hex');
		
		// verify id isn't existing already
		var filteredRO = receiverObjs.filter(function(el, idx, array) {
			return el.id === callback.id;
		});
		if (filteredRO.length > 0)
			throw new Error('Cannot register, already got object with same id.');

		receiverObjs.push(callback);
		this.objects[callback.api] = receiverObjs;
	};

	/**
	 * Registers a Webinos service object as RPC request receiver.
	 * @param callback The callback object that contains the methods available via RPC.
	 */
	Registry.prototype.registerObject = function (callback) {
		_registerObject.call(this, callback);

		if (this.parent && this.parent.registerServicesWithPzh) {
			this.parent.registerServicesWithPzh();
		}
	};

	/**
	 * Unregisters an object, so it can no longer receives requests.
	 * @param callback The callback object to unregister.
	 */
	Registry.prototype.unregisterObject = function (callback) {
		if (!callback) {
			return;
		}
		logger.log("Removing: " + callback.api);
		var receiverObjs = this.objects[callback.api];

		if (!receiverObjs)
			receiverObjs = [];

		var filteredRO = receiverObjs.filter(function(el, idx, array) {
			return el.id !== callback.id;
		});
		if (filteredRO.length > 0) {
			this.objects[callback.api] = filteredRO;
		} else {
			delete this.objects[callback.api];
		}

		if (this.parent && this.parent.registerServicesWithPzh) {
			this.parent.registerServicesWithPzh();
		}
	};

	/**
	 * Get all registered objects.
	 *
	 * Objects are returned in a key-value map whith service type as key and
	 * value being an array of objects for that service type.
	 */
	Registry.prototype.getRegisteredObjectsMap = function() {
		return this.objects;
	};

	/**
	 * Get service matching type and id.
	 * @param serviceTyp Service type as string.
	 * @param serviceId Service id as string.
	 */
	Registry.prototype.getServiceWithTypeAndId = function(serviceTyp, serviceId) {
		var receiverObjs = this.objects[serviceTyp];
		if (!receiverObjs)
			receiverObjs = [];

		var filteredRO = receiverObjs.filter(function(el, idx, array) {
			return el.id === serviceId;
		});

		if (filteredRO.length < 1) {
			if (/ServiceDiscovery|Dashboard/.test(serviceTyp)) {
				return receiverObjs[0];
			}
			return undefined;
		}

		return filteredRO[0];
	};

	Registry.prototype.emitEvent = function(event) {
		var that = this;
		Object.keys(this.objects).forEach(function(serviceTyp) {
			if (!that.objects[serviceTyp]) return;

			that.objects[serviceTyp].forEach(function(service) {
				if (!service.listeners) return;
				if (!service.listeners[event.name]) return;

				service.listeners[event.name].forEach(function(listener) {
					try {
						listener(event);
					} catch(e) {
						console.log('service event listener error:');
						console.log(e);
					};
				});
			});
		});
	};

	// Export definitions for node.js
	if (typeof module !== 'undefined'){
		exports.Registry = Registry;
		var crypto = require('crypto');
	} else {
		// export for web browser
		window.Registry = Registry;
	}
})();
/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 ******************************************************************************/

(function () {
	if (typeof webinos === 'undefined')
		webinos = {};
	var logger = console;

	var idCount = 0;

	/**
	 * RPCHandler constructor
	 *  @constructor
	 *  @param parent The PZP object or optional else.
	 */
	var _RPCHandler = function(parent, registry) {
		/**
		 * Parent is the PZP. The parameter is not used/optional on PZH and the
		 * web browser.
		 */
		this.parent = parent;

		/**
		 * Registry of registered RPC objects.
		 */
		this.registry = registry;

		/**
		 * session id
		 */
		this.sessionId = '';

		/**
		 * Map to store callback objects on which methods can be invoked.
		 * Used by one request to many replies pattern.
		 */
		this.callbackObjects = {};

		/**
		 * Used on the client side by executeRPC to store callbacks that are
		 * invoked once the RPC finished.
		 */
		this.awaitingResponse = {};

		this.checkPolicy;

		this.messageHandler = {
			write: function() {
				logger.log("could not execute RPC, messageHandler was not set.");
			}
		};
	};

	/**
	 * Sets the writer that should be used to write the stringified JSON RPC request.
	 * @param messageHandler Message handler manager.
	 */
	_RPCHandler.prototype.setMessageHandler = function (messageHandler){
		this.messageHandler = messageHandler;
	};

	/**
	 * Create and return a new JSONRPC 2.0 object.
	 * @function
	 * @private
	 */
	var newJSONRPCObj = function(id) {
		return {
			jsonrpc: '2.0',
			id: id || getNextID()
		};
	};

	/**
	 * Creates a new unique identifier to be used for RPC requests and responses.
	 * @function
	 * @private
	 * @param used for recursion
	 */
	var getNextID = function(a) {
		// implementation taken from here: https://gist.github.com/982883
		return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,getNextID);
	};

	/**
	 * Preliminary object to hold information to create JSONRPC request object.
	 * @function
	 * @private
	 */
	var newPreRPCRequest = function(method, params) {
		var rpc = newJSONRPCObj();
		rpc.method = method;
		rpc.params = params || [];
		rpc.preliminary = true;
		return rpc;
	};

	/**
	 * Create and return a new JSONRPC 2.0 request object.
	 * @function
	 * @private
	 */
	var toJSONRPC = function(preRPCRequest) {
		if (preRPCRequest.preliminary) {
			var rpcRequest = newJSONRPCObj(preRPCRequest.id);
			rpcRequest.method = preRPCRequest.method;
			rpcRequest.params = preRPCRequest.params;
			return rpcRequest;
		} else {
			return preRPCRequest;
		}
	};

	/**
	 * Create and return a new JSONRPC 2.0 response result object.
	 * @function
	 * @private
	 */
	var newJSONRPCResponseResult = function(id, result) {
		var rpc = newJSONRPCObj(id);
		rpc.result = typeof result === 'undefined' ? {} : result;
		return rpc;
	};

	/**
	 * Create and return a new JSONRPC 2.0 response error object.
	 * @function
	 * @private
	 */
	var newJSONRPCResponseError = function(id, error) {
		var rpc = newJSONRPCObj(id);
		rpc.error = {
				data: error,
				code: -31000,
				message: 'Method Invocation returned with error'
		};
		return rpc;
	};

	/**
	 * Handles a JSON RPC request.
	 * @param request JSON RPC request object.
	 * @param from The sender.
	 * @function
	 * @private
	 */
	var handleRequest = function (request, from) {
		var isCallbackObject;

		var idx = request.method.lastIndexOf('.');
		var service = request.method.substring(0, idx);
		var method = request.method.substring(idx + 1);
		var serviceId;
		idx = service.indexOf('@');
		if (idx !== -1) {
			// extract service type and id, e.g. service@id
			var serviceIdRest = service.substring(idx + 1);
			service = service.substring(0, idx);
			var idx2 = serviceIdRest.indexOf('.');
			if (idx2 !== -1) {
				serviceId = serviceIdRest.substring(0, idx2);
			} else {
				serviceId = serviceIdRest;
			}
		} else if (!/ServiceDiscovery|Dashboard/.test(service)) {
			// request to object registered with registerCallbackObject
			isCallbackObject = true;
		}
		//TODO send back error if service and method is not webinos style

		if (service.length === 0) {
			logger.log("Cannot handle request because of missing service in request");
			return;
		}

		logger.log("Got request to invoke " + method + " on " + service + (serviceId ? "@" + serviceId : "") +" with params: " + request.params );

		var includingObject;
		if (isCallbackObject) {
			includingObject = this.callbackObjects[service];
		} else {
			includingObject = this.registry.getServiceWithTypeAndId(service, serviceId);
		}

		if (!includingObject) {
			logger.log("No service found with id/type " + service);
			return;
		}

		// takes care of finding functions bound to attributes in nested objects
		idx = request.method.lastIndexOf('.');
		var methodPathParts = request.method.substring(0, idx);
		methodPathParts = methodPathParts.split('.');
		// loop through the nested attributes
		for (var pIx = 0; pIx<methodPathParts.length; pIx++) {
			if (methodPathParts[pIx] && methodPathParts[pIx].indexOf('@') >= 0) continue;
			if (methodPathParts[pIx] && includingObject[methodPathParts[pIx]]) {
				includingObject = includingObject[methodPathParts[pIx]];
			}
		}

		if (typeof includingObject === 'object') {
			var id = request.id;
			var that = this;

			var successCallback = function (result) {
				if (typeof id === 'undefined') return;
				var rpc = newJSONRPCResponseResult(id, result);
				that.executeRPC(rpc, undefined, undefined, from);
			}

			var errorCallback = function (error) {
				if (typeof id === 'undefined') return;
				var rpc = newJSONRPCResponseError(id, error);
				that.executeRPC(rpc, undefined, undefined, from);
			}

			// registration object (in case of "one request to many responses" use)
			var fromObjectRef = {
				rpcId: request.id,
				from: from
			};

			// call the requested method
			includingObject[method](request.params, successCallback, errorCallback, fromObjectRef);
		}
	};

	/**
	 * Handles a JSON RPC response.
	 * @param response JSON RPC response object.
	 * @function
	 * @private
	 */
	var handleResponse = function (response) {
		// if no id is provided we cannot invoke a callback
		if (!response.id) return;

		logger.log("Received a response that is registered for " + response.id);

		// invoking linked error / success callback
		if (this.awaitingResponse[response.id]) {
			var waitResp = this.awaitingResponse[response.id];

			if (waitResp.onResult && typeof response.result !== "undefined") {
				waitResp.onResult(response.result);
				logger.log("RPC called scb for response");
			}

			if (waitResp.onError && response.error) {
				if (response.error.data) {
					this.awaitingResponse[response.id].onError(response.error.data);
				}
				else {
					this.awaitingResponse[response.id].onError();
				}
				logger.log("RPC called ecb for response");
			}
				delete this.awaitingResponse[response.id];

		} else if (this.callbackObjects[response.id]) {
			// response is for a rpc callback obj
			var callbackObj = this.callbackObjects[response.id];

			if (callbackObj.onSecurityError && response.error &&
					response.error.data && response.error.data.name === 'SecurityError') {

				callbackObj.onSecurityError(response.error.data);
				logger.log('Received SecurityError response.');
			}
			logger.log('Dropping received response for RPC callback obj.');
		}
	};

	/**
	 * Handles a new JSON RPC message (as string)
	 * @param message The RPC message coming in.
	 * @param from The sender.
	 */
	_RPCHandler.prototype.handleMessage = function (jsonRPC, from){
		var self = this;
		logger.log("New packet from messaging");
		logger.log("Response to " + from);

		// Helper function for handling rpc
		function doRPC() {
			if (typeof jsonRPC.method !== 'undefined' && jsonRPC.method != null) {
				// received message is RPC request
				handleRequest.call(self, jsonRPC, from);
			} else {
				// received message is RPC response
				handleResponse.call(self, jsonRPC, from);
			}
		}

		// Check policy
		if (this.checkPolicy) {
			// Do policy check. Will callback when response (or timeout) received.
			this.checkPolicy(jsonRPC, from, function(isAllowed) {
				// Prompt or callback received.
				if (!isAllowed) {
					// Request denied - issue security error (to do - this doesn't propagate properly to the client).
					var rpc = newJSONRPCResponseError(jsonRPC.id, {name: "SecurityError", code: 18, message: "Access has been denied."});
					self.executeRPC(rpc, undefined, undefined, from);
				} else {
					// Request permitted - handle RPC.
					doRPC();
				}
			});
		} else {
			// No policy checking => handle RPC right now.
			doRPC();
		}
	};

	/**
	 * Executes the given RPC request and registers an optional callback that
	 * is invoked if an RPC response with same id was received.
	 * @param rpc An RPC object create with createRPC.
	 * @param callback Success callback.
	 * @param errorCB Error callback.
	 * @param from Sender.
	 */
	_RPCHandler.prototype.executeRPC = function (preRpc, callback, errorCB, from) {
		var rpc = toJSONRPC(preRpc);

		if (typeof callback === 'function' || typeof errorCB === 'function'){
			var cb = {};
			if (typeof callback === 'function') cb.onResult = callback;
			if (typeof errorCB === 'function') cb.onError = errorCB;
			if (typeof rpc.id !== 'undefined') this.awaitingResponse[rpc.id] = cb;
		}

		// service invocation case
		if (typeof preRpc.serviceAddress !== 'undefined') {
			from = preRpc.serviceAddress;
		}

		if (typeof module !== 'undefined') {
			this.messageHandler.write(rpc, from);
		} else {
			// this only happens in the web browser
			webinos.session.message_send(rpc, from);
		}
	};


	/**
	 * Creates a JSON RPC 2.0 compliant object.
	 * @param service The service (e.g., the file reader or the
	 * 		  camera service) as RPCWebinosService object instance.
	 * @param method The method that should be invoked on the service.
	 * @param params An optional array of parameters to be used.
	 * @returns RPC object to execute.
	 */
	_RPCHandler.prototype.createRPC = function (service, method, params) {
		if (!service) throw "Service is undefined";
		if (!method) throw "Method is undefined";

		var rpcMethod;

		if (service.api && service.id) {
			// e.g. FileReader@cc44b4793332831dc44d30b0f60e4e80.truncate
			// i.e. (class name) @ (md5 hash of service meta data) . (method in class to invoke)
			rpcMethod = service.api + "@" + service.id + "." + method;
		} else if (service.rpcId && service.from) {
			rpcMethod = service.rpcId + "." + method;
		} else {
			rpcMethod = service + "." + method;
		}

		var preRPCRequest = newPreRPCRequest(rpcMethod, params);

		if (service.serviceAddress) {
			preRPCRequest.serviceAddress = service.serviceAddress;
		} else if (service.from) {
			preRPCRequest.serviceAddress = service.from;
		}

		return preRPCRequest;
	};

	/**
	 * Registers an object as RPC request receiver.
	 * @param callback RPC object from createRPC with added methods available via RPC.
	 */
	_RPCHandler.prototype.registerCallbackObject = function (callback) {
		if (!callback.id) {
			// can only happen when registerCallbackObject is called before
			// calling createRPC. file api impl does it this way. that's why
			// the id generated here is then used in notify method below
			// to overwrite the rpc.id, as they need to be the same
			callback.id = getNextID();
		}

		// register
		this.callbackObjects[callback.id] = callback;
	};

	/**
	 * Unregisters an object as RPC request receiver.
	 * @param callback The callback object to unregister.
	 */
	_RPCHandler.prototype.unregisterCallbackObject = function (callback) {
		delete this.callbackObjects[callback.id];
	};

	/**
	 * Registers a policy check function.
	 * @param checkPolicy
	 */
	_RPCHandler.prototype.registerPolicycheck = function (checkPolicy) {
		this.checkPolicy = checkPolicy;
	};

	/**
	 * Utility method that combines createRPC and executeRPC.
	 * @param service The service (e.g., the file reader or the
	 * 		  camera service) as RPCWebinosService object instance.
	 * @param method The method that should be invoked on the service.
	 * @param objectRef RPC object reference.
	 * @param successCallback Success callback.
	 * @param errorCallback Error callback.
	 * @returns Function which when called does the rpc.
	 */
	_RPCHandler.prototype.request = function (service, method, objectRef, successCallback, errorCallback) {
		var self = this; // TODO Bind returned function to "this", i.e., an instance of RPCHandler?

		function callback(maybeCallback) {
			if (typeof maybeCallback !== "function") {
				return function () {};
			}
			return maybeCallback;
		}

		return function () {
			var params = Array.prototype.slice.call(arguments);
			var message = self.createRPC(service, method, params);

			if (objectRef && objectRef.api)
				message.id = objectRef.api;
			else if (objectRef)
				message.id = objectRef;

			self.executeRPC(message, callback(successCallback), callback(errorCallback));
		};
	};

	/**
	 * Utility method that combines createRPC and executeRPC.
	 *
	 * For notification only, doesn't support success or error callbacks.
	 * @param service The service (e.g., the file reader or the
	 * 		  camera service) as RPCWebinosService object instance.
	 * @param method The method that should be invoked on the service.
	 * @param objectRef RPC object reference.
	 * @returns Function which when called does the rpc.
	 */
	_RPCHandler.prototype.notify = function (service, method, objectRef) {
		return this.request(service, method, objectRef, function(){}, function(){});
	};

	/**
	 * RPCWebinosService object to be registered as RPC module.
	 *
	 * The RPCWebinosService has fields with information about a Webinos service.
	 * It is used for three things:
	 * 1) For registering a webinos service as RPC module.
	 * 2) The service discovery module passes this into the constructor of a
	 *	webinos service on the client side.
	 * 3) For registering a RPC callback object on the client side using ObjectRef
	 *	as api field.
	 * When registering a service the constructor should be called with an object
	 * that has the following three fields: api, displayName, description. When
	 * used as RPC callback object, it is enough to specify the api field and set
	 * that to ObjectRef.
	 * @constructor
	 * @param obj Object with fields describing the service.
	 */
	var RPCWebinosService = function (obj) {
		this.listeners = {};
		if (!obj) {
			this.id = '';
			this.api = '';
			this.displayName = '';
			this.description = '';
			this.serviceAddress = '';
		} else {
			this.id = obj.id || '';
			this.api = obj.api || '';
			this.displayName = obj.displayName || '';
			this.description = obj.description || '';
			this.serviceAddress = obj.serviceAddress || '';
		}
	};

	/**
	 * Get an information object from the service.
	 * @returns Object including id, api, displayName, serviceAddress.
	 */
	RPCWebinosService.prototype.getInformation = function () {
		return {
			id: this.id,
			api: this.api,
			displayName: this.displayName,
			description: this.description,
			serviceAddress: this.serviceAddress
		};
	};

	RPCWebinosService.prototype._addListener = function (event, listener) {
		if (!event || !listener) throw new Error('missing event or listener');

		if (!this.listeners[event]) this.listeners[event] = [];
		this.listeners[event].push(listener);
	};

	RPCWebinosService.prototype._removeListener = function (event, listener) {
		if (!event || !listener) return;
		this.listeners[event].forEach(function(l, i) {
			if (l === listener) this.listeners[event][i] = null;
		});
	};

	/**
	 * Webinos ServiceType from ServiceDiscovery
	 * @constructor
	 * @param api String with API URI.
	 */
	var ServiceType = function(api) {
		if (!api)
			throw new Error('ServiceType: missing argument: api');

		this.api = api;
	};

	/**
	 * Set session id.
	 * @param id Session id.
	 */
	_RPCHandler.prototype.setSessionId = function(id) {
		this.sessionId = id;
	};

	/**
	 * Export definitions for node.js
	 */
	if (typeof module !== 'undefined'){
		exports.RPCHandler = _RPCHandler;
		exports.Registry = require('./registry.js').Registry;
		exports.RPCWebinosService = RPCWebinosService;
		exports.ServiceType = ServiceType;

	} else {
		// export for web browser
		window.RPCHandler = _RPCHandler;
		window.RPCWebinosService = RPCWebinosService;
		window.ServiceType = ServiceType;
	}
})();
/*******************************************************************************
*  Code contributed to the webinos project
* 
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*  
*     http://www.apache.org/licenses/LICENSE-2.0
*  
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
* Copyright 2012 Ziran Sun, Samsung Electronics(UK) Ltd
******************************************************************************/
(function ()	{
"use strict";
  var logger = console;
  if (typeof module !== "undefined") {
    var webinos_= require("webinos-utilities").webinosLogging(__filename);
  }
	function logObj(obj, name)	{
		for (var myKey in obj)	{
			if (typeof obj[myKey] === 'object')
			{
				logger.log(name + "["+myKey +"] = "+JSON.stringify(obj[myKey]));
				logObj(obj[myKey], name + "." + myKey);
			}
		}
	}

	/** Message fields:
	 *
	 * var message = {
	 * register: false    //register sender if true
	 * ,type: "JSONRPC"   // JSONRPC message or other
	 * ,id:   0           // messageid used to
	 * ,from:  null       // sender address
	 * ,to:    null       // reciever address
	 * ,resp_to:   null   // the destination to pass RPC result back to
	 * ,timestamp:  0     // currently this parameter is not used
	 * ,timeout:  null    // currently this parameter is not used
	 * ,payload:  null    // message body - RPC object
	 * };
	 */

	/** Address description:

	 * address format in current session Manager code - PZH/PZP/appid/instanceid
	 * address format defined in http://dev.webinos.org/redmine/projects/wp4/wiki/Entity_Naming_for_Messaging is:
	 * https://her_domain.com/webinos/other_user/urn:services-webinos-org:calender
	 *
	 * other_user@her_domain.com                        <-- name of user identity (PZH?)
	 *  |
	 * +-- laptop                                     <-- name of the PZP
	 *         |
	 *        +-- urn:services-webinos-org:calender    <-- service type
	 *              |
	 *              +-- A0B3
	 * other_user@her_domain.com/laptop/urn:services-webinos-org:calender/
	 */

	/**
	 * MessageHandler constructor
	 *  @constructor
	 *  @param rpcHandler RPC handler manager.
	 */
	var MessageHandler = function (rpcHandler) {
		this.sendMsg = null;

		this.ownSessionId = null;
		this.separator = null;

		this.rpcHandler = rpcHandler;
		this.rpcHandler.setMessageHandler(this);

		/**
		 * To store the session id after registration. e.g. PZP registers with
		 * PZH, PZH creates a session id X for PZP. client[PZP->PZH] = X
		 *
		 *  TODO need to adjust clients[] to accommodate PZH farm, PZP farm scenarios
		 */
		this.clients = {};
	};

	/**
	 * Set the sendMessage function that should be used to send message.
	 * Developers use this function to call different sendmessage APIs under
	 * different communication environment. e.g. in socket.io, the
	 * sendMessageFunction could be: io.sockets.send(sessionid);
	 * @param sendMessageFunction A function that used for sending messages.
	 */
	MessageHandler.prototype.setSendMessage = function (sendMessageFunction) {
		this.sendMsg = sendMessageFunction;
	};

	/**
	 * Function to set own session identity.
	 * @param ownSessionId pz session id
	 */
	MessageHandler.prototype.setOwnSessionId = function (ownSessionId) {
		this.ownSessionId = ownSessionId;
	};

	/**
	 * Function to get own session identity.
	 */
	MessageHandler.prototype.getOwnSessionId = function () {
		return this.ownSessionId;
	};

	/**
	 * Set separator used to in Addressing to separator different part of the address.
	 * e.g. PZH/PZP/APPID, "/" is the separator here
	 * @param sep The separator that used in address representation
	 */

	MessageHandler.prototype.setSeparator = function (sep) {
		this.separator = sep;
	};

	/**
	 *  Create a register message.
	 *  Use the created message to send it to an entity, this will setup a session
	 *  on the receiver side. The receiver will then route messages to the
	 *  sender of this message.
	 *  @param from Message originator
	 *  @param to  Message destination
	 */
	MessageHandler.prototype.createRegisterMessage = function(from, to) {
		logger.log('creating register msg to send from ' + from + ' to ' + to);
		if (from === to) throw new Error('cannot create register msg to itself');

		var msg = {
			register: true,
			to: to,
			from: from,
			type: 'JSONRPC',
			payload: null
		};

		return msg;
	};

	/**
	 *  Remove stored session route. This function is called once session is closed.
	 *  @param sender Message sender or forwarder
	 *  @param receiver Message receiver
	 */
	MessageHandler.prototype.removeRoute = function (sender, receiver) {
		var session = [sender, receiver].join("->");
		if (this.clients[session]) {
			delete this.clients[session];
		}
	};

	/**
	 * Returns true if msg is a msg for app on wrt connected to this pzp.
	 */
	function isLocalAppMsg(msg) {
		if (/(?:\/[a-f0-9]+){2,}/.exec(msg.to) // must include /$id/$otherid to be wrt
				&& /\//.exec(this.ownSessionId) // must include "/" to be pzp
				&& msg.to.substr(0, this.ownSessionId.length) === this.ownSessionId) {
			return true;
		}
		return false;
	}

	/**
	 * Somehow finds out the PZH address and returns it?
	 */
	function getPzhAddr(message) {
		// check occurances of separator used in addressing
		var data = message.to.split(this.separator);
		var occurences = data.length - 1;
		var id = data[0];
		var forwardto = data[0];

		// strip from right side
		for (var i = 1; i < occurences; i++) {
			id = id + this.separator + data[i];
			var new_session1 = [id, this.ownSessionId].join("->");
			var new_session2 = [this.ownSessionId, id].join("->");

			if (this.clients[new_session1] || this.clients[new_session2]) {
				forwardto = id;
			}
		}

		if (forwardto === data[0]) {
			var s1 = [forwardto, this.ownSessionId].join("->");
			var s2 = [this.ownSessionId, forwardto].join("->");
			if (this.clients[s1] || this.clients[s2])
				forwardto = data[0];
			else
			{
				var own_addr = this.ownSessionId.split(this.separator);
				var own_pzh = own_addr[0]
				if (forwardto !== own_pzh) {
					forwardto = own_pzh;
				}
			}
		}
		return forwardto;
	}

	/**
	 * RPC writer - referto write function in  RPC
	 * @param rpc Message body
	 * @param to Destination for rpc result to be sent to
	 */
	MessageHandler.prototype.write = function (rpc, to) {
		if (!to) throw new Error('to is missing, cannot send message');

		var message = {
			to: to,
			resp_to: this.ownSessionId,
			from: this.ownSessionId
		};

		if (typeof rpc.jsonrpc !== "undefined") {
			message.type = "JSONRPC";
		}

		message.payload = rpc;

		var session1 = [to, this.ownSessionId].join("->");
		var session2 = [this.ownSessionId, to].join("->");

		if ((!this.clients[session1]) && (!this.clients[session2])) { // not registered either way
			logger.log("session not set up");
			var forwardto = getPzhAddr.call(this, message);

			if (isLocalAppMsg.call(this, message)) {
				// msg from this pzp to wrt previously connected to this pzp
				console.log('drop message, wrt disconnected');
				return;
			}

			logger.log("message forward to:" + forwardto);
			this.sendMsg(message, forwardto);
		}
		else if (this.clients[session2]) {
			logger.log("clients[session2]:" + this.clients[session2]);
			this.sendMsg(message, this.clients[session2]);
		}
		else if (this.clients[session1]) {
			logger.log("clients[session1]:" + this.clients[session1]);
			this.sendMsg(message, this.clients[session1]);
		}
	};

	/**
	 *  Handle message routing on receiving message. it does -
	 *  [1] Handle register message and create session path for newly registered party
	 *  [2] Forward messaging if not message destination
	 *  [3] Handle message  by calling RPC handler if it is message destination
	 *  @param message	Received message
	 *  @param sessionid session id
	 */
	MessageHandler.prototype.onMessageReceived = function (message, sessionid) {
		if (typeof message === "string") {
			try {
				message = JSON.parse(message);
			} catch (e) {
				log.error("JSON.parse (message) - error: "+ e.message);
			}
		}

		if (message.hasOwnProperty("register") && message.register) {
			var from = message.from;
			var to = message.to;
			if (to !== undefined) {
				var regid = [from, to].join("->");

				//Register message to associate the address with session id
				if (message.from) {
					this.clients[regid] = message.from;
				}
				else if (sessionid) {
					this.clients[regid] = sessionid;
				}

				logger.log("register Message");
			}
			return;
		}
		// check message destination
		else if (message.hasOwnProperty("to") && (message.to)) {

			//check if a session with destination has been stored
			if(message.to !== this.ownSessionId) {
				logger.log("forward Message");

				//if no session is available for the destination, forward to the hop nearest,
				//i.e A->D, if session for D is not reachable, check C, then check B if C is not reachable
				var to = message.to;
				var session1 = [to, this.ownSessionId].join("->");
				var session2 = [this.ownSessionId, to].join("->");

				// not registered either way
				if ((!this.clients[session1]) && (!this.clients[session2])) {
					logObj(message, "Sender, receiver not registered either way");
					var forwardto = getPzhAddr.call(this, message);

					if (isLocalAppMsg.call(this, message)) {
						// msg from other pzp to wrt previously connected to this pzp
						console.log('drop message, wrt disconnected');
						return;
					}

					logger.log("message forward to:" + forwardto);
					this.sendMsg(message, forwardto);
				}
				else if (this.clients[session2]) {
					this.sendMsg(message, this.clients[session2]);
				}
				else if (this.clients[session1]) {
					this.sendMsg(message, this.clients[session1]);
				}
				return;
			}
			//handle message on itself
			else {
				if (message.payload) {
					if(message.to != message.resp_to) {
						var from = message.from;
						this.rpcHandler.handleMessage(message.payload, from);
					}
					else {
						if (typeof message.payload.method !== "undefined") {
							var from = message.from;
							this.rpcHandler.handleMessage(message.payload, from);
						}
						else {
							if (typeof message.payload.result !== "undefined" || typeof message.payload.error !== "undefined") {
								this.rpcHandler.handleMessage(message.payload);
							}
						}
					}
				}
				else {
					// what other message type are we expecting?
				}
				return;
			}
			return;
		}
	};

	// TODO add fucntion to release clients[] when session is closed -> this will also affect RPC callback funcs

	/**
	 * Export messaging handler definitions for node.js
	 */
	if (typeof exports !== 'undefined') {
		exports.MessageHandler = MessageHandler;
	} else {
		// export for web browser
		window.MessageHandler = MessageHandler;
	}

}());
/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 * Copyright 2012 - 2013 Samsung Electronics (UK) Ltd
 * Authors: Habib Virji
 ******************************************************************************/
if (typeof exports === "undefined") exports = window;
if (typeof exports.webinos === "undefined") exports.webinos = {};
if (typeof exports.webinos.session === "undefined") exports.webinos.session = {};

if (typeof _webinos === "undefined") {
    _webinos = {};
    _webinos.registerServiceConstructor = function(){};
}

(function() {
    "use strict";

    var sessionId = null, pzpId, pzhId, connectedDevices =[], isConnected = false, enrolled = false, mode, port = 8080,
        serviceLocation, webinosVersion,listenerMap = {}, channel;
    function callListenerForMsg(data) {
        var listeners = listenerMap[data.payload.status] || [];
        for(var i = 0;i < listeners.length;i++) {
            listeners[i](data) ;
        }
    }
    function setWebinosMessaging() {
        webinos.messageHandler.setOwnSessionId(sessionId);
        var msg = webinos.messageHandler.createRegisterMessage(pzpId, sessionId);
        webinos.messageHandler.onMessageReceived(msg, msg.to);
    }
    function updateConnected(message){
        pzhId = message.pzhId;
        connectedDevices = message.connectedDevices;
        isConnected = !!(webinos.session.getConnectedPzh().indexOf(pzhId) !== -1);
        enrolled = message.enrolled;
        mode = message.mode;
    }
    function setWebinosSession(data){
        sessionId = data.to;
        pzpId     = data.from;
        if(data.payload.message) {
            updateConnected(data.payload.message);
        }
        setWebinosMessaging();
    }
    function setWebinosVersion(data) {
        webinosVersion = data.payload.message;
    }
    webinos.session.setChannel = function(_channel) {
        channel = _channel;
    };
    webinos.session.setPzpPort = function (port_) {
        port = port_;
    };
    webinos.session.getPzpPort = function () {
        return port;
    };
    webinos.session.message_send_messaging = function(msg, to) {
        msg.resp_to = webinos.session.getSessionId();
        channel.send(JSON.stringify(msg));
    };
    webinos.session.message_send = function(rpc, to) {
        var type;
        if(rpc.type !== undefined && rpc.type === "prop") {
            type = "prop";
            rpc = rpc.payload;
        }else {
            type = "JSONRPC";
        }
        if (typeof to === "undefined") {
            to = pzpId;
        }
        var message = {"type":type,
            "from":webinos.session.getSessionId(),
            "to":to,
            "resp_to":webinos.session.getSessionId(),
            "payload":rpc};
        if(rpc.register !== "undefined" && rpc.register === true) {
            console.log(rpc);
            channel.send(JSON.stringify(rpc));
        }else {
            console.log("creating callback");
            console.log("WebSocket Client: Message Sent");
            console.log(message);
            channel.send(JSON.stringify(message));
        }
    };
    webinos.session.setServiceLocation = function (loc) {
        serviceLocation = loc;
    };
    webinos.session.getServiceLocation = function () {
        if (typeof serviceLocation !== "undefined") {
            return serviceLocation;
        } else {
            return pzpId;
        }
    };
    webinos.session.getSessionId = function () {
        return sessionId;
    };
    webinos.session.getPZPId = function () {
        return pzpId;
    };
    webinos.session.getPZHId = function () {
        return ( pzhId || "");
    };
    webinos.session.getConnectedDevices = function () {
        return (connectedDevices || []);
    };
    webinos.session.getConnectedPzh = function () {
       var list =[];
       if(pzhId) {
         for (var i = 0 ; i < connectedDevices.length; i = i + 1){
           list.push(connectedDevices[i].id);
         }
       }
       return list;
    };
    webinos.session.getConnectedPzp = function () {
        var list =[];
        for (var i = 0 ; i < connectedDevices.length; i = i + 1){
            if(!pzhId) {
              list.push(connectedDevices[i]);
            } else {
              for (var j = 0; j < (connectedDevices[i].pzp && connectedDevices[i].pzp.length); j = j + 1){
               list.push(connectedDevices[i].pzp[j].id);
              }
           }
        }
        return list;
    };
    webinos.session.getFriendlyName = function(id){
        for (var i = 0 ; i < connectedDevices.length; i = i + 1){
            if(connectedDevices[i] === id || connectedDevices[i].id === id) {
                return connectedDevices[i].friendlyName;
            }
            for (var j = 0 ; j < (connectedDevices[i].pzp && connectedDevices[i].pzp.length); j = j + 1){
                if(connectedDevices[i].pzp[j].id === id) {
                    return connectedDevices[i].pzp[j].friendlyName;
                }
            }
        }
    };
    webinos.session.addListener = function (statusType, listener) {
        var listeners = listenerMap[statusType] || [];
        listeners.push (listener);
        listenerMap[statusType] = listeners;
        return listeners.length;
    };
    webinos.session.removeListener = function (statusType, id) {
        var listeners = listenerMap[statusType] || [];
        try {
            listeners[id - 1] = undefined;
        } catch (e) {
        }
    };
    webinos.session.isConnected = function () {
        return isConnected;
    };
    webinos.session.getPzpModeState = function (mode_name) {
        return  (enrolled && mode[mode_name] === "connected");
    };
    webinos.session.getWebinosVersion = function() {
        return webinosVersion;
    };
    webinos.session.handleMsg = function(data) {
        if(typeof data === "object" && data.type === "prop") {
            switch(data.payload.status) {
                case "registeredBrowser":
                    setWebinosSession(data);
                    callListenerForMsg(data);
                    break;
                case "pzpFindPeers":
                    callListenerForMsg(data);
                    break;
                case "pubCert":
                    callListenerForMsg(data);
                    break;
                case "showHashQR":
                    callListenerForMsg(data);
                    break;
                case "addPzpQR":
                    callListenerForMsg(data);
                    break;
                case "requestRemoteScanner":
                    callListenerForMsg(data);
                    break;
                case "checkHashQR":
                    callListenerForMsg(data);
                    break;
                case "sendCert":
                    callListenerForMsg(data);
                    break;
                case "connectPeers":
                    callListenerForMsg(data);
                    break;
                case "intraPeer":
                    callListenerForMsg(data);
                    break;
                case "update":
                    setWebinosSession(data);
                    callListenerForMsg(data);
                    break;
                case "infoLog":
                    callListenerForMsg(data);
                    break;
                case "errorLog":
                    callListenerForMsg(data);
                    break;
                case "error":
                    callListenerForMsg(data);
                    break;
                case "friendlyName":
                    callListenerForMsg(data);
                    break;
                case "webinosVersion":
                    setWebinosVersion(data);
                    callListenerForMsg(data);
                    break;
                case "pzhDisconnected":
                    isConnected = false;
                    callListenerForMsg(data);
                    break;
                case "gatherTestPageLinks":
                    callListenerForMsg(data);
                    break;
            }
        }
    }
}());
/*******************************************************************************
 * Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 ******************************************************************************/

(function () {
    function isOnNode() {
        return typeof module === "object" ? true : false;
    }

    var allTypes = [
        'http://webinos.org/api/actuators',
        'http://webinos.org/api/app2app',
        'http://webinos.org/api/applauncher',
        'http://webinos.org/api/authentication',
        'http://webinos.org/api/context',
        'http://webinos.org/api/corePZinformation',
        'http://webinos.org/api/deviceorientation',
        'http://webinos.org/api/devicestatus',
        'http://webinos.org/api/discovery',
        'http://webinos.org/api/events',
        'http://webinos.org/api/file',
        'http://webinos.org/api/mediacontent',
        'http://webinos.org/api/nfc',
        'http://webinos.org/api/notifications',
        'http://webinos.org/api/payment',
        'http://webinos.org/api/sensors',
        'http://webinos.org/api/test',
        'http://webinos.org/api/tv',
        'http://webinos.org/api/vehicle',
        'http://webinos.org/api/w3c/geolocation',
        'http://www.w3.org/ns/api-perms/geolocation',
        'http://www.w3.org/ns/api-perms/contacts',
        'http://webinos.org/api/internal/zonenotification',
        'http://webinos.org/manager/discovery/bluetooth',
        'http://webinos.org/mwc/oauth',
        'http://webinos.org/core/policymanagement'
    ];

    var typeMap = {};

    var registerServiceConstructor = function(serviceType, Constructor) {
        var isValid = allTypes.reduce(function(prev, curr) {
            if (prev) return prev;
            return curr === serviceType;
        }, false);

        if (!isValid) {
            console.log("discovery: serviceType not valid, didn't register constructor for", serviceType);
            return;
        }
        console.log("discovery: registered constructor for", serviceType);
        typeMap[serviceType] = Constructor;
    };
    if (typeof _webinos !== 'undefined') _webinos.registerServiceConstructor = registerServiceConstructor;

    if (isOnNode()) {
        var path = require('path');
        var moduleRoot = path.resolve(__dirname, '../') + '/';
        var moduleDependencies = require(moduleRoot + '/dependencies.json');
        var webinosRoot = path.resolve(moduleRoot + moduleDependencies.root.location) + '/';
        var dependencies = require(path.resolve(webinosRoot + '/dependencies.json'));

        var Context = require(path.join(webinosRoot, dependencies.wrt.location, 'lib/webinos.context.js')).Context;
    }

    /**
     * Interface DiscoveryInterface
     */
    var ServiceDiscovery = function (rpcHandler) {
        var _webinosReady = false;
        var callerCache = [];

        /**
         * Search for registered services.
         * @param {ServiceType} serviceType ServiceType object to search for.
         * @param {FindCallBack} callback Callback to call with results.
         * @param {Options} options Timeout, optional.
         * @param {Filter} filter Filters based on location, name, description, optional.
         */
        this.findServices = function (serviceType, callback, options, filter) {
            var that = this;
            var findOp;

            var typeMapCompatible = {};
            if (typeof ActuatorModule !== 'undefined') typeMapCompatible['http://webinos.org/api/actuators'] = ActuatorModule;
            if (typeof App2AppModule !== 'undefined') typeMapCompatible['http://webinos.org/api/app2app'] = App2AppModule;
            if (typeof AppLauncherModule !== 'undefined') typeMapCompatible['http://webinos.org/api/applauncher'] = AppLauncherModule;
            if (typeof AuthenticationModule !== 'undefined') typeMapCompatible['http://webinos.org/api/authentication'] = AuthenticationModule;
            if (typeof webinos.Context !== 'undefined') typeMapCompatible['http://webinos.org/api/context'] = webinos.Context;
            if (typeof corePZinformationModule !== 'undefined') typeMapCompatible['http://webinos.org/api/corePZinformation'] = corePZinformationModule;
            if (typeof DeviceStatusManager !== 'undefined') typeMapCompatible['http://webinos.org/api/devicestatus'] = DeviceStatusManager;
            if (typeof DiscoveryModule !== 'undefined') typeMapCompatible['http://webinos.org/api/discovery'] = DiscoveryModule;
            if (typeof EventsModule !== 'undefined') typeMapCompatible['http://webinos.org/api/events'] = EventsModule;
            if (webinos.file && webinos.file.Service) typeMapCompatible['http://webinos.org/api/file'] = webinos.file.Service;
            if (typeof MediaContentModule !== 'undefined') typeMapCompatible['http://webinos.org/api/mediacontent'] = MediaContentModule;
            if (typeof NfcModule !== 'undefined') typeMapCompatible['http://webinos.org/api/nfc'] = NfcModule;
            if (typeof WebNotificationModule !== 'undefined') typeMapCompatible['http://webinos.org/api/notifications'] = WebNotificationModule;
            if (typeof WebinosDeviceOrientation !== 'undefined') typeMapCompatible['http://webinos.org/api/deviceorientation'] = WebinosDeviceOrientation;
            if (typeof PaymentModule !== 'undefined') typeMapCompatible['http://webinos.org/api/payment'] = PaymentModule;
            if (typeof Sensor !== 'undefined') typeMapCompatible['http://webinos.org/api/sensors'] = Sensor;
            if (typeof TestModule !== 'undefined') typeMap['http://webinos.org/api/test'] = TestModule;
            if (typeof TVManager !== 'undefined') typeMapCompatible['http://webinos.org/api/tv'] = TVManager;
            if (typeof Vehicle !== 'undefined') typeMapCompatible['http://webinos.org/api/vehicle'] = Vehicle;
            if (typeof WebinosGeolocation !== 'undefined') typeMapCompatible['http://webinos.org/api/w3c/geolocation'] = WebinosGeolocation;
            if (typeof WebinosGeolocation !== 'undefined') typeMapCompatible['http://www.w3.org/ns/api-perms/geolocation'] = WebinosGeolocation; // old feature URI for compatibility
            if (typeof Contacts !== 'undefined') typeMapCompatible['http://www.w3.org/ns/api-perms/contacts'] = Contacts;
            if (typeof ZoneNotificationModule !== 'undefined') typeMapCompatible['http://webinos.org/api/internal/zonenotification'] = ZoneNotificationModule;
//            if (typeof DiscoveryModule !== 'undefined') typeMapCompatible['http://webinos.org/manager/discovery/bluetooth'] = DiscoveryModule;
            if (typeof oAuthModule !== 'undefined') typeMapCompatible['http://webinos.org/mwc/oauth'] = oAuthModule;
            if (typeof PolicyManagementModule !== 'undefined') typeMapCompatible['http://webinos.org/core/policymanagement'] = PolicyManagementModule;

            
            var rpc = rpcHandler.createRPC('ServiceDiscovery', 'findServices',
                    [serviceType, options, filter]);
            
            var timer = setTimeout(function () {
                rpcHandler.unregisterCallbackObject(rpc);
                // If no results return TimeoutError.
                if (!findOp.found && typeof callback.onError === 'function') {
                    callback.onError(new DOMError('TimeoutError', ''));
                }
            }, options && typeof options.timeout !== 'undefined' ?
                        options.timeout : 120000 // default timeout 120 secs
            );
            
            findOp = new PendingOperation(function() {
                // remove waiting requests from callerCache
                var index = callerCache.indexOf(rpc);
                if (index >= 0) {
                    callerCache.splice(index, 1);
                }
                rpcHandler.unregisterCallbackObject(rpc);
                if (typeof callback.onError === 'function') {
                    callback.onError(new DOMError('AbortError', ''));
                }
            }, timer);
            
            var success = function (params) {
                console.log("servicedisco: service found.");
                var baseServiceObj = params;

                // reduce feature uri to base form, e.g. http://webinos.org/api/sensors
                // instead of http://webinos.org/api/sensors.light etc.
                var stype = /(?:.*(?:\/[\w]+)+)/.exec(baseServiceObj.api);
                stype = stype ? stype[0] : undefined;

                var ServiceConstructor = typeMap[stype] || typeMapCompatible[stype];
                if (ServiceConstructor) {
                    // elevate baseServiceObj to usable local WebinosService object
                    var service = new ServiceConstructor(baseServiceObj, rpcHandler);
                    findOp.found = true;
                    callback.onFound(service);
                } else {
                    var serviceErrorMsg = 'Cannot instantiate webinos service.';
                    console.log(serviceErrorMsg);
                    if (typeof callback.onError === 'function') {
                        callback.onError(new DiscoveryError(102, serviceErrorMsg));
                    }
                }
            }; // End of function success
            
            // The core of findService.
            rpc.onservicefound = function (params) {
                // params is the parameters needed by the API method.
                success(params);
            };
            
            // Refer to the call in
            // Webinos-Platform/webinos/core/api/servicedisco/lib/rpc_servicediso.js.
            rpc.onSecurityError = function (params) {
                if (typeof findOp !== 'undefined' && typeof callback.onError === 'function') {
                    callback.onError(new DOMError('SecurityError', ''));
                }
            };
            
            // Add this pending operation.
            rpcHandler.registerCallbackObject(rpc);
            
            if (typeof rpcHandler.parent !== 'undefined') {
                rpc.serviceAddress = rpcHandler.parent.config.pzhId;
            } else {
                rpc.serviceAddress = webinos.session.getServiceLocation();
            }
            
            if (!isOnNode() && !_webinosReady) {
                callerCache.push(rpc);
            } else {
                // Only do it when _webinosReady is true.
                rpcHandler.executeRPC(rpc);
            }
            
            return findOp;
        };  // End of findServices.
        
        if (isOnNode()) {
            return;
        }
        
        // further code only runs in the browser
        
        webinos.session.addListener('registeredBrowser', function () {
            _webinosReady = true;
            for (var i = 0; i < callerCache.length; i++) {
                var req = callerCache[i];
                rpcHandler.executeRPC(req);
            }
            callerCache = [];
        });
    };
    
    /**
     * Export definitions for node.js
     */
    if (isOnNode()) {
        exports.ServiceDiscovery = ServiceDiscovery;
    } else {
        // this adds ServiceDiscovery to the window object in the browser
        window.ServiceDiscovery = ServiceDiscovery;
    }
    
    /**
     * Interface PendingOperation
     */
    function PendingOperation(cancelFunc, timer) {
        this.found = false;
        
        this.cancel = function () {
            clearTimeout(timer);
            cancelFunc();
        };
    }
    
    function DOMError(name, message) {
        return {
            name: name,
            message: message
        };
    }

    webinos.discovery = new ServiceDiscovery (webinos.rpcHandler);
    webinos.ServiceDiscovery = webinos.discovery; // for backward compat
}());
/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 ******************************************************************************/
(function () {
    var channel = null;

    /**
     * Creates the socket communication channel
     * for a locally hosted websocket server at port 8080
     * for now this channel is used for sending RPC, later the webinos
     * messaging/eventing system will be used
     */
    function createCommChannel (successCB) {
        var channel = null;
        if (typeof WebinosSocket !== 'undefined') { // Check if we are inside Android widget renderer.
            channel = new WebinosSocket ();
        } else { // We are not in Android widget renderer so we can use a browser websocket.
            var port, hostname;
            var defaultHost = "localhost";
            var defaultPort = "8080";
            var isWebServer = true;
            var useDefaultHost = false;
            var useDefaultPort = false;

            // Get web server info.

            // Get web server port.
            port = window.location.port - 0 || 80;
            // Find web server hostname.
            hostname = window.location.hostname;
            if (hostname == "") isWebServer = false; // We are inside a local file.

            // Find out the communication socket info.

            // Set the communication channel's port.
            if (isWebServer) {
                try {
                    var xmlhttp = new XMLHttpRequest ();
                    xmlhttp.open ("GET", "/webinosConfig.json", false);
                    xmlhttp.send ();
                    if (xmlhttp.status == 200) {
                        var resp = JSON.parse (xmlhttp.responseText);
                        port = resp.websocketPort;
                    } else { // We are not inside a pzp or widget server.
                        console.log ("CAUTION: webinosConfig.json failed to load. Are you on a pzp/widget server or older version of webinos? Trying the guess  communication channel's port.");
                        port = port + 1; // Guessing that the port is +1 to the webserver's. This was the way to detect it on old versions of pzp.
                    }
                } catch (err) { // XMLHttpRequest is not supported or something went wrong with it.
                    console.log ("CAUTION: The pzp communication host and port are unknown. Trying the default communication channel.");
                    useDefaultHost = true;
                    useDefaultPort = true;
                }
            } else { // Let's try the default pzp hostname and port.
                console.log ("CAUTION: No web server detected. Using a local file? Trying the default communication channel.");
                useDefaultHost = true;
                useDefaultPort = true;
            }
            // Change the hostname to the default if required.
            if (useDefaultHost) hostname = defaultHost;
            // Change the port to the default if required.
            if (useDefaultPort) port = defaultPort;

            // We are ready to make the connection.

            // Get the correct websocket object.
            var ws = window.WebSocket || window.MozWebSocket;
            try {
                channel = new ws ("ws://" + hostname + ":" + port);
            } catch (err) { // Websockets are not available for this browser. We need to investigate in order to support it.
                throw new Error ("Your browser does not support websockets. Please report your browser on webinos.org.");
            }
        }
        webinos.session.setChannel (channel);
        webinos.session.setPzpPort (port);

        channel.onmessage = function (ev) {
            console.log ('WebSocket Client: Message Received : ' + JSON.stringify (ev.data));
            var data = JSON.parse (ev.data);
            if (data.type === "prop") {
                webinos.session.handleMsg (data);
            } else {
                //webinos.messageHandler.setOwnSessionId (webinos.session.getSessionId ());
                //webinos.messageHandler.setSendMessage (webinos.session.message_send_messaging);
                webinos.messageHandler.onMessageReceived (data, data.to);
            }
        };
        channel.onopen = function() {
          var url = window.location.pathname;
          webinos.session.message_send({type: 'prop', payload: {status:'registerBrowser', value: url}});
        };
    }

    createCommChannel ();

    webinos.rpcHandler = new RPCHandler (undefined, new Registry ());
    webinos.messageHandler = new MessageHandler (webinos.rpcHandler);

} ());
/*******************************************************************************
*  Code contributed to the webinos project
* 
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*  
*     http://www.apache.org/licenses/LICENSE-2.0
*  
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
* 
* Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
******************************************************************************/
(function() {

	/**
	 * Webinos Get42 service constructor (client side).
	 * @constructor
	 * @param obj Object containing displayName, api, etc.
	 */
	TestModule = function(obj) {
		WebinosService.call(this, obj);
		
		this._testAttr = "HelloWorld";
		this.__defineGetter__("testAttr", function (){
			return this._testAttr + " Success";
		});
	};
	_webinos.registerServiceConstructor("http://webinos.org/api/test", TestModule);
	
	/**
	 * To bind the service.
	 * @param bindCB BindCallback object.
	 */
	TestModule.prototype.bindService = function (bindCB, serviceId) {
		// actually there should be an auth check here or whatever, but we just always bind
		this.get42 = get42;
		this.listenAttr = {};
		this.listenerFor42 = listenerFor42.bind(this);
		
		if (typeof bindCB.onBind === 'function') {
			bindCB.onBind(this);
		};
	}
	
	/**
	 * Get 42.
	 * An example function which does a remote procedure call to retrieve a number.
	 * @param attr Some attribute.
	 * @param successCB Success callback.
	 * @param errorCB Error callback. 
	 */
	function get42(attr, successCB, errorCB) {
		console.log(this.id);
		var rpc = webinos.rpcHandler.createRPC(this, "get42", [attr]);
		webinos.rpcHandler.executeRPC(rpc,
				function (params){
					successCB(params);
				},
				function (error){
					errorCB(error);
				}
		);
	}
	
	/**
	 * Listen for 42.
	 * An exmaple function to register a listener which is then called more than
	 * once via RPC from the server side.
	 * @param listener Listener function that gets called.
	 * @param options Optional options.
	 */
	function listenerFor42(listener, options) {
		var rpc = webinos.rpcHandler.createRPC(this, "listenAttr.listenFor42", [options]);

		// add one listener, could add more later
		rpc.onEvent = function(obj) {
			// we were called back, now invoke the given listener
			listener(obj);
			webinos.rpcHandler.unregisterCallbackObject(rpc);
		};

		webinos.rpcHandler.registerCallbackObject(rpc);
		webinos.rpcHandler.executeRPC(rpc);
	}
	
}());