'use strict';
/**
* Helpers to mock the AWS SDK Services using sinon.js under the hood
* Export two functions:
* - mock
* - restore
*
* Mocking is done in two steps:
* - mock of the constructor for the service on AWS
* - mock of the method on the service
**/

var sinon = require('sinon');
var traverse = require('traverse');
var _AWS  = require('aws-sdk');
var Readable = require('stream').Readable;

var AWS      = {};
var services = {};

/**
 * Sets the aws-sdk to be mocked.
 */
AWS.setSDK = function(path) {
  _AWS = require(path);
};

AWS.setSDKInstance = function(sdk) {
  _AWS = sdk;
};

/**
 * Stubs the service and registers the method that needs to be mocked.
 */
AWS.mock = function(service, method, replace) {
  // If the service does not exist yet, we need to create and stub it.
  if (!services[service]) {
    services[service]             = {};

    /**
     * Save the real constructor so we can invoke it later on.
     * Uses traverse for easy access to nested services (dot-separated)
     */
    services[service].Constructor = traverse(_AWS).get(service.split('.'));
    services[service].methodMocks = {};
    services[service].invoked = false;
    mockService(service);
  }

  // Register the method to be mocked out.
  if(!services[service].methodMocks[method]) {
    services[service].methodMocks[method] = { replace: replace };

    // If the constructor was already invoked, we need to mock the method here.
    if(services[service].invoked) {
      mockServiceMethod(service, services[service].client, method, replace);
    }
  }
  return services[service].methodMocks[method];
};

/**
 * Stub the constructor for the service on AWS.
 * E.g. calls of new AWS.SNS() are replaced.
 */
function mockService(service) {
  var nestedServices = service.split('.');
  var method = nestedServices.pop();
  var object = traverse(_AWS).get(nestedServices);

  var serviceStub = sinon.stub(object, method).callsFake(function(args) {
    services[service].invoked = true;

    /**
     * Create an instance of the service by calling the real constructor
     * we stored before. E.g. var client = new AWS.SNS()
     * This is necessary in order to mock methods on the service.
     */
    var client               = new services[service].Constructor(args);
    services[service].client = client;

    // Once this has been triggered we can mock out all the registered methods.
    for (var key in services[service].methodMocks) {
      mockServiceMethod(service, client, key, services[service].methodMocks[key].replace);
    };
    return client;
  });
  services[service].stub = serviceStub;
};

/**
 *  Stubs the method on a service.
 *
 * All AWS service methods take two argument:
 *  - params: an object.
 *  - callback: of the form 'function(err, data) {}'.
 */
function mockServiceMethod(service, client, method, replace) {
  services[service].methodMocks[method].stub = sinon.stub(client, method).callsFake(function() {
    var args = Array.prototype.slice.call(arguments);

    var userArgs, userCallback;
    if (typeof(args[(args.length || 1) - 1]) === 'function') {
      userArgs = args.slice(0, -1);
      userCallback = args[(args.length || 1) - 1];
    } else {
      userArgs = args;
    }
    var havePromises = typeof(AWS.Promise) === 'function';
    var promise, resolve, reject, storedResult;
    var tryResolveFromStored = function() {
      if (storedResult && promise) {
        if (typeof storedResult.then === 'function') {
          storedResult.then(resolve, reject)
        } else if (storedResult.reject) {
          reject(storedResult.reject);
        } else {
          resolve(storedResult.resolve);
        }
      }
    };
    var callback = function(err, data) {
      if (!storedResult) {
        if (err) {
          storedResult = {reject: err};
        } else {
          storedResult = {resolve: data};
        }
      }
      if (userCallback) {
        userCallback(err, data);
      }
      tryResolveFromStored();
    };
    var request = {
      promise: havePromises ? function() {
        if (!promise) {
          promise = new AWS.Promise(function (resolve_, reject_) {
            resolve = resolve_;
            reject = reject_;
          });
        }
        tryResolveFromStored();
        return promise;
      } : undefined,
      createReadStream: function() {
        if (replace instanceof Readable) {
          return replace;
        } else {
          var stream = new Readable();
          stream._read = function(size) {
            if(typeof(replace) === 'string' || Buffer.isBuffer(replace)) {
              this.push(replace);
            }
            this.push(null);
          };
          return stream;
        }
      },
      on: function(eventName, callback) {
      },
      send: function(callback) {
      }
    };

    // different locations for the paramValidation property
    var config = (client.config || client.options || _AWS.config);
    if (config.paramValidation) {
      try {
        // different strategies to find method, depending on wether the service is nested/unnested
        var inputRules =
          ((client.api && client.api.operations[method]) || client[method] || {}).input;
        if (inputRules) {
          var params = userArgs[(userArgs.length || 1) - 1];
          new _AWS.ParamValidator((client.config || _AWS.config).paramValidation).validate(inputRules, params);
        }
      } catch (e) {
        callback(e, null);
        return request;
      }
    }

    // If the value of 'replace' is a function we call it with the arguments.
    if(typeof(replace) === 'function') {
      var result = replace.apply(replace, userArgs.concat([callback]));
      if (storedResult === undefined && result != null &&
          typeof result.then === 'function') {
        storedResult = result
      }
    }
    // Else we call the callback with the value of 'replace'.
    else {
      callback(null, replace);
    }
    return request;
  });
}

/**
 * Restores the mocks for just one method on a service, the entire service, or all mocks.
 *
 * When no parameters are passed, everything will be reset.
 * When only the service is passed, that specific service will be reset.
 * When a service and method are passed, only that method will be reset.
 */
AWS.restore = function(service, method) {
  if(!service) {
    restoreAllServices();
  } else {
    if (method) {
      restoreMethod(service, method);
    } else {
      restoreService(service);
    }
  };
};

/**
 * Restores all mocked service and their corresponding methods.
 */
function restoreAllServices() {
  for (var service in services) {
    restoreService(service);
  }
}

/**
 * Restores a single mocked service and its corresponding methods.
 */
function restoreService(service) {
  if (services[service]) {
    restoreAllMethods(service);
    if( services[service].stub)
      services[service].stub.restore();
    delete services[service];
  } else {
    console.log('Service ' + service + ' was never instantiated yet you try to restore it.');
  }
}

/**
 * Restores all mocked methods on a service.
 */
function restoreAllMethods(service) {
  for (var method in services[service].methodMocks) {
    restoreMethod(service, method);
  }
}

/**
 * Restores a single mocked method on a service.
 */
function restoreMethod(service, method) {
  if (services[service] && services[service].methodMocks[method]) {
    if (services[service].methodMocks[method].stub) {
      services[service].methodMocks[method].stub.restore();
    }
    delete services[service].methodMocks[method];
  } else {
    console.log('Method ' + service + ' was never instantiated yet you try to restore it.');
  }

}

(function(){
  var setPromisesDependency = _AWS.config.setPromisesDependency;
  /* istanbul ignore next */
  /* only to support for older versions of aws-sdk */
  if (typeof(setPromisesDependency) === 'function') {
    AWS.Promise = global.Promise;
    _AWS.config.setPromisesDependency = function(p) {
      AWS.Promise = p;
      return setPromisesDependency(p);
    };
  }
})();

module.exports = AWS;
