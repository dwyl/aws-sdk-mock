var sinon = require('sinon');
var aws = require('aws-sdk');

var core = {};
var AWS = {};

AWS.mock = function(service, method) {
  core[service] = {};
  core[service].awsConstructor = aws[service];
  mockService(service, method);
}

function mockService(service, method) {
  sinon.stub(aws, service, function() {
    var client = new core[service].awsConstructor();
    client.sandbox = sinon.sandbox.create();
    mockServiceMethod(client, method);
    return client;
  });
}

function mockServiceMethod(client, method) {
  client.sandbox.stub(client, method, function(params, callback) {
    return callback();
  });
}

AWS.restore = function(service, method) {

};

module.exports = AWS;
