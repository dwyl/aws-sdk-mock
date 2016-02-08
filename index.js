'use strict';
/**
* Helpers to mock the AWS SDK Services using sinon.js under the hood
* Export two functions:
* - mock
* - restore
*
* Mocking in done in two steps:
* - mock of the constructor for the service on AWS
* - mock of the method on the service
**/

var sinon = require('sinon');
var _AWS  = require('aws-sdk');

var AWS      = {};
var services = {};

/*
 Checks if a mock of a service already exists before creating it

 Saves the real constructor for the service so it can be invoked
 in the next step e.g save AWS.SNS to the services object

 Checks if a mock of a method on a service already exists before creating it
*/

AWS.mock = function(service, method, replace) {
  if (!services[service]) {
    services[service]             = {};
    services[service].Constructor = _AWS[service];
    services[service].methodMocks = []
    mockService(service, method, replace);
  } else {
    var methodMockExists = services[service].methodMocks.indexOf(method) > -1;
    if (!methodMockExists) {
      mockServiceMethod(service, method, replace);
    } else { return; }
  }
}

/*
  Stub the constructor for the service on AWS. e.g. calls of new AWS.SNS()
  are replaced

  Creates an instance of the service by calling the real constructor
  i.e. var client =new AWS.SNS()
  This is necessary in order to mock the method on the service in the next step

  Saves the stub to the services object so it can be restored after the test
*/
function mockService(service, method, replace) {
  var serviceStub = sinon.stub(_AWS, service, function() {
    var client               = new services[service].Constructor();
    client.sandbox           = sinon.sandbox.create();
    services[service].client = client;
    mockServiceMethod(service, method, replace);
    return client;
  });
  services[service].stub = serviceStub;
}

/*
  Stubs the method on the service

  All AWS service methods take two arguments
    - params: an object
    - callback: of the form function(err, data){}
  If the value of 'replace' is a function'it is called with the arguments
  Otherwise the callback is called with the value of replace
*/

function mockServiceMethod(service, method, replace) {
  var client = services[service].client;
  services[service].methodMocks.push(method);
  client.sandbox.stub(client, method, function(params, callback) {
    if(typeof(replace) === 'function') {
      return replace(params, callback);
    } else {
      return callback(null, replace);
    }
  });
}

/*
  Restores the mocks for just one method on a service, the entire service, or all mocks
*/

AWS.restore = function(service, method) {

  var args                  = Array.prototype.slice.call(arguments).length;
  var restoreService        = args === 1;
  var restoreServiceMethod  = args === 2
  // var restoreAll            = args === 0;

  if (restoreServiceMethod){
    services[service].client[method].restore();
    services[service].methodMocks = services[service].methodMocks.filter(function(mock){
      return mock !== method;
    });
  } else if (restoreService) {
    services[service].stub.restore();
    services[service].client.sandbox.restore();
    delete services[service];
  } else {
    // restoreAll
    for (var option in services) {
      services[option].stub.restore();
      services[option].client.sandbox.restore();
      delete services[option];
    }
  };
};

module.exports = AWS;
