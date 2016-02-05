var sinon = require('sinon');
var _AWS = require('aws-sdk');

var core = {};
var AWS = {};

AWS.mock = function(service, method, replace) {
  core[service] = {};
  core[service].awsConstructor = _AWS[service];
  mockService(service, method, replace);
}

function mockService(service, method, replace) {
  var serviceStub = sinon.stub(_AWS, service, function() {
    var client = new core[service].awsConstructor();
    client.sandbox = sinon.sandbox.create();
    core[service].client = client;
    mockServiceMethod(client, method, replace);
    return client;
  });
  core[service].stub = serviceStub;
}

function mockServiceMethod(client, method, replace) {
  client.sandbox.stub(client, method, function(params, callback) {
    if(typeof(replace) === 'function') {
      return replace(params, callback);
    } else {
      return callback(null, replace);
    }
  });
}

AWS.restore = function(service) {
  core[service].client.sandbox.restore();
  core[service].stub.restore();
  delete core[service];
};

module.exports = AWS;
