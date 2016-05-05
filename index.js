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

var AWS      = {};
var services = {};

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
}

/**
 * Stub the constructor for the service on AWS.
 * E.g. calls of new AWS.SNS() are replaced.
 */
function mockService(service) {
  var nestedServices = service.split('.');
  var method = nestedServices.pop();
  var object = traverse(_AWS).get(nestedServices);

  var serviceStub = sinon.stub(object, method, function(args) {
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
  services[service].methodMocks[method].stub = sinon.stub(client, method, function() {
    var args = Array.prototype.slice.call(arguments);

    // If the method was called w/o a callback function, assume they are consuming a Promise
    if(typeof(args[args.length - 1]) !== 'function' && typeof(AWS.Promise) === 'function') {
      return {
        promise: function() {
          return new AWS.Promise(function(resolve, reject) {
            // Provide a callback function for the mock to invoke
            args.push(function(err, val) { return err ? reject(err) : resolve(val) })
            return invokeMock()
          })
        }
      }
    }

    return (function invokeMock() {
      // If the value of 'replace' is a function we call it with the arguments.
      if(typeof(replace) === 'function') {
        return replace.apply(replace, args);
      }
      // Else we call the callback with the value of 'replace'.
      else {
        var callback = args[args.length - 1];
        return callback(null, replace);
      }
    })()
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
}

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
  restoreAllMethods(service);
  services[service].stub.restore();
  delete services[service];
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
  services[service].methodMocks[method]
  services[service].methodMocks[method].stub.restore();
  delete services[service].methodMocks[method];
}

(function(){
  var setPromisesDependency = _AWS.config.setPromisesDependency;
  if (typeof(setPromisesDependency) === 'function') {
    AWS.Promise = typeof(Promise) === 'function' ? Promise : null;
    _AWS.config.setPromisesDependency = function(p) {
      AWS.Promise = p;
      return setPromisesDependency(p);
    };
  }
})()

module.exports = AWS;
