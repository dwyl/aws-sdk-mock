var tap = require('tap');
var test = tap.test;
var awsMock = require('../index.js');
var AWS = require('aws-sdk');
var isNodeStream = require('is-node-stream');
var concatStream = require('concat-stream');
var Readable = require('stream').Readable;

AWS.config.paramValidation = false;

tap.afterEach(function (done) {
  awsMock.restore();
  done();
});

test('AWS.mock function should mock AWS service and method on the service', function(t){
  t.test('mock function replaces method with a function that returns replace string', function(st){
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      st.end();
    });
  });
  t.test('mock function replaces method with replace function', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      st.end();
    });
  });
  t.test('method which accepts any number of arguments can be mocked', function(st) {
    awsMock.mock('S3', 'getSignedUrl', 'message');
    var s3 = new AWS.S3();
    s3.getSignedUrl('getObject', {}, function(err, data) {
      st.equals(data, 'message');
      awsMock.mock('S3', 'upload', function(params, options, callback) {
        callback(null, options);
      });
      s3.upload({}, {test: 'message'}, function(err, data) {
        st.equals(data.test, 'message');
        st.end();
      });
    });
  });
  t.test('method fails on invalid input if paramValidation is set', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    var s3 = new AWS.S3({paramValidation: true});
    s3.getObject({Bucket: 'b', notKey: 'k'}, function(err, data) {
      st.ok(err);
      st.notOk(data);
      st.end();
    });
  });
  t.test('method with no input rules can be mocked even if paramValidation is set', function(st) {
    awsMock.mock('S3', 'getSignedUrl', 'message');
    var s3 = new AWS.S3({paramValidation: true});
    s3.getSignedUrl('getObject', {}, function(err, data) {
      st.equals(data, 'message');
      st.end();
    });
  });
  t.test('method succeeds on valid input when paramValidation is set', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    var s3 = new AWS.S3({paramValidation: true});
    s3.getObject({Bucket: 'b', Key: 'k'}, function(err, data) {
      st.notOk(err);
      st.equals(data.Body, 'body');
      st.end();
    });
  });
  t.test('method is not re-mocked if a mock already exists', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    var sns = new AWS.SNS();
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'test');
    });
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      st.end();
    });
  });
  t.test('service is not re-mocked if a mock already exists', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    var sns = new AWS.SNS();
    awsMock.mock('SNS', 'subscribe', function(params, callback){
      callback(null, 'test');
    });
    sns.subscribe({}, function(err, data){
      st.equals(data, 'test');
      st.end();
    });
  });
  t.test('service is re-mocked when remock called', function(st){
    awsMock.mock('SNS', 'subscribe', function(params, callback){
      callback(null, 'message 1');
    });
    var sns = new AWS.SNS();
    awsMock.remock('SNS', 'subscribe', function(params, callback){
      callback(null, 'message 2');
    });
    sns.subscribe({}, function(err, data){
      st.equals(data, 'message 2');
      st.end();
    });
  });
  t.test('multiple methods can be mocked on the same service', function(st){
    awsMock.mock('Lambda', 'getFunction', function(params, callback) {
      callback(null, 'message');
    });
    awsMock.mock('Lambda', 'createFunction', function(params, callback) {
      callback(null, 'message');
    });
    var lambda = new AWS.Lambda();
    lambda.getFunction({}, function(err, data) {
      st.equals(data, 'message');
      lambda.createFunction({}, function(err, data) {
        st.equals(data, 'message');
        st.end();
      });
    });
  });
  if (typeof(Promise) === 'function') {
    t.test('promises are supported', function(st){
      var error = new Error('on purpose');
      awsMock.mock('Lambda', 'getFunction', function(params, callback) {
        callback(null, 'message');
      });
      awsMock.mock('Lambda', 'createFunction', function(params, callback) {
        callback(error, 'message');
      });
      var lambda = new AWS.Lambda();
      lambda.getFunction({}).promise().then(function(data) {
        st.equals(data, 'message');
      }).then(function(){
        return lambda.createFunction({}).promise();
      }).catch(function(data){
        st.equals(data, error);
        st.end();
      });
    });
    t.test('replacement returns thennable', function(st){
      var error = new Error('on purpose');
      awsMock.mock('Lambda', 'getFunction', function(params) {
        return Promise.resolve('message')
      });
      awsMock.mock('Lambda', 'createFunction', function(params, callback) {
        return Promise.reject(error)
      });
      var lambda = new AWS.Lambda();
      lambda.getFunction({}).promise().then(function(data) {
        st.equals(data, 'message');
      }).then(function(){
        return lambda.createFunction({}).promise();
      }).catch(function(data){
        st.equals(data, error);
        st.end();
      });
    });
    t.test('no unhandled promise rejections when promises are not used', function(st) {
      process.on('unhandledRejection', function(reason, promise) {
        st.fail('unhandledRejection, reason follows');
        st.error(reason);
      });
      awsMock.mock('S3', 'getObject', function(params, callback) {
        callback('This is a test error to see if promise rejections go unhandled');
      });
      var S3 = new AWS.S3();
      S3.getObject({}, function(err, data) {});
      st.end();
    });
    t.test('promises work with async completion', function(st){
      var error = new Error('on purpose');
      awsMock.mock('Lambda', 'getFunction', function(params, callback) {
        setTimeout(callback.bind(this, null, 'message'), 10);
      });
      awsMock.mock('Lambda', 'createFunction', function(params, callback) {
        setTimeout(callback.bind(this, error, 'message'), 10);
      });
      var lambda = new AWS.Lambda();
      lambda.getFunction({}).promise().then(function(data) {
        st.equals(data, 'message');
      }).then(function(){
        return lambda.createFunction({}).promise();
      }).catch(function(data){
        st.equals(data, error);
        st.end();
      });
    });
    t.test('promises can be configured', function(st){
      awsMock.mock('Lambda', 'getFunction', function(params, callback) {
        callback(null, 'message');
      });
      var lambda = new AWS.Lambda();
      function P(handler) {
        var self = this;
        function yay (value) {
          self.value = value;
        }
        handler(yay, function(){});
      }
      P.prototype.then = function(yay) { if (this.value) yay(this.value) };
      AWS.config.setPromisesDependency(P);
      var promise = lambda.getFunction({}).promise();
      st.equals(promise.constructor.name, 'P');
      promise.then(function(data) {
        st.equals(data, 'message');
        st.end();
      });
    });
  }
  t.test('request object supports createReadStream', function(st) {
    awsMock.mock('S3', 'getObject', 'body');
    var s3 = new AWS.S3();
    var req = s3.getObject('getObject', function(err, data) {});
    st.ok(isNodeStream(req.createReadStream()));
    // with or without callback
    req = s3.getObject('getObject');
    st.ok(isNodeStream(req.createReadStream()));
    // stream is currently always empty but that's subject to change.
    // let's just consume it and ignore the contents
    req = s3.getObject('getObject');
    var stream = req.createReadStream();
    stream.pipe(concatStream(function() {
      st.end();
    }));
  });
  t.test('request object createReadStream works with streams', function(st) {
    var bodyStream = new Readable();
    bodyStream.push('body');
    bodyStream.push(null);
    awsMock.mock('S3', 'getObject', bodyStream);
    var stream = new AWS.S3().getObject('getObject').createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equals(actual.toString(), 'body');
      st.end();
    }));
  });
  t.test('request object createReadStream works with strings', function(st) {
    awsMock.mock('S3', 'getObject', 'body');
    var s3 = new AWS.S3();
    var req = s3.getObject('getObject', {});
    var stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equals(actual.toString(), 'body');
      st.end();
    }));
  });
  t.test('request object createReadStream works with buffers', function(st) {
    awsMock.mock('S3', 'getObject', Buffer.alloc(4, 'body'));
    var s3 = new AWS.S3();
    var req = s3.getObject('getObject', {});
    var stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equals(actual.toString(), 'body');
      st.end();
    }));
  });
  t.test('request object createReadStream ignores functions', function(st) {
    awsMock.mock('S3', 'getObject', function(){});
    var s3 = new AWS.S3();
    var req = s3.getObject('getObject', {});
    var stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equals(actual.toString(), '');
      st.end();
    }));
  });
  t.test('request object createReadStream ignores non-buffer objects', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    var s3 = new AWS.S3();
    var req = s3.getObject('getObject', {});
    var stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equals(actual.toString(), '');
      st.end();
    }));
  });
  t.test('call on method of request object', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    var s3 = new AWS.S3();
    var req = s3.getObject('getObject', {});
    st.equals(typeof req.on, 'function');
    st.end();
  });
  t.test('call send method of request object', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    var s3 = new AWS.S3();
    var req = s3.getObject('getObject', {});
    st.equals(typeof req.send, 'function');
    st.end();
  });
  t.test('all the methods on a service are restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    st.equals(AWS.SNS.isSinonProxy, true);

    awsMock.restore('SNS');

    st.equals(AWS.SNS.hasOwnProperty('isSinonProxy'), false);
    st.end();
  });
  t.test('only the method on the service is restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    var sns = new AWS.SNS();
    st.equals(AWS.SNS.isSinonProxy, true);
    st.equals(sns.publish.isSinonProxy, true);

    awsMock.restore('SNS', 'publish');

    st.equals(AWS.SNS.hasOwnProperty('isSinonProxy'), true);
    st.equals(sns.publish.hasOwnProperty('isSinonProxy'), false);
    st.end();
  });
  t.test('all the services are restored when no arguments given to awsMock.restore', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    awsMock.mock('DynamoDB', 'putItem', function(params, callback){
      callback(null, 'test');
    });
    awsMock.mock('DynamoDB.DocumentClient', 'put', function(params, callback){
      callback(null, 'test');
    });
    var sns = new AWS.SNS();
    var docClient = new AWS.DynamoDB.DocumentClient();
    var dynamoDb = new AWS.DynamoDB();

    st.equals(AWS.SNS.isSinonProxy, true);
    st.equals(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equals(AWS.DynamoDB.isSinonProxy, true);
    st.equals(sns.publish.isSinonProxy, true);
    st.equals(docClient.put.isSinonProxy, true);
    st.equals(dynamoDb.putItem.isSinonProxy, true);

    awsMock.restore();

    st.equals(AWS.SNS.hasOwnProperty('isSinonProxy'), false);
    st.equals(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy'), false);
    st.equals(AWS.DynamoDB.hasOwnProperty('isSinonProxy'), false);
    st.equals(sns.publish.hasOwnProperty('isSinonProxy'), false);
    st.equals(docClient.put.hasOwnProperty('isSinonProxy'), false);
    st.equals(dynamoDb.putItem.hasOwnProperty('isSinonProxy'), false);
    st.end();
  });
  t.test('a nested service can be mocked properly', function(st){
    awsMock.mock('DynamoDB.DocumentClient', 'put', 'message');
    var docClient = new AWS.DynamoDB.DocumentClient();
    awsMock.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
      callback(null, 'test');
    });
    awsMock.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
      callback(null, 'test');
    });

    st.equals(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equals(docClient.put.isSinonProxy, true);
    st.equals(docClient.get.isSinonProxy, true);

    docClient.put({}, function(err, data){
      st.equals(data, 'message');
      docClient.get({}, function(err, data){
        st.equals(data, 'test');

        awsMock.restore('DynamoDB.DocumentClient', 'get');
        st.equals(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
        st.equals(docClient.get.hasOwnProperty('isSinonProxy'), false);

        awsMock.restore('DynamoDB.DocumentClient');
        st.equals(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy'), false);
        st.equals(docClient.put.hasOwnProperty('isSinonProxy'), false);
        st.end();
      });
    });
  });
  t.test('a nested service can be mocked properly even when paramValidation is set', function(st){
    awsMock.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
      callback(null, 'test');
    });
    var docClient = new AWS.DynamoDB.DocumentClient({paramValidation: true});

    st.equals(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equals(docClient.query.isSinonProxy, true);
    docClient.query({}, function(err, data){
      console.warn(err);
      st.equals(data, 'test');
      st.end();
    });
  });
  t.test('a mocked service and a mocked nested service can coexist as long as the nested service is mocked first', function(st) {
    awsMock.mock('DynamoDB.DocumentClient', 'get', 'message');
    awsMock.mock('DynamoDB', 'getItem', 'test');
    var docClient = new AWS.DynamoDB.DocumentClient();
    var dynamoDb = new AWS.DynamoDB();

    st.equals(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equals(AWS.DynamoDB.isSinonProxy, true);
    st.equals(docClient.get.isSinonProxy, true);
    st.equals(dynamoDb.getItem.isSinonProxy, true);

    awsMock.restore('DynamoDB');
    st.equals(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equals(AWS.DynamoDB.hasOwnProperty('isSinonProxy'), false);
    st.equals(docClient.get.isSinonProxy, true);
    st.equals(dynamoDb.getItem.hasOwnProperty('isSinonProxy'), false);

    awsMock.mock('DynamoDB', 'getItem', 'test');
    dynamoDb = new AWS.DynamoDB();
    st.equals(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equals(AWS.DynamoDB.isSinonProxy, true);
    st.equals(docClient.get.isSinonProxy, true);
    st.equals(dynamoDb.getItem.isSinonProxy, true);

    awsMock.restore('DynamoDB.DocumentClient');

    // the first assertion is true because DynamoDB is still mocked
    st.equals(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy'), true);
    st.equals(AWS.DynamoDB.isSinonProxy, true);
    st.equals(docClient.get.hasOwnProperty('isSinonProxy'), false);
    st.equals(dynamoDb.getItem.isSinonProxy, true);

    awsMock.restore('DynamoDB');
    st.equals(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy'), false);
    st.equals(AWS.DynamoDB.hasOwnProperty('isSinonProxy'), false);
    st.equals(docClient.get.hasOwnProperty('isSinonProxy'), false);
    st.equals(dynamoDb.getItem.hasOwnProperty('isSinonProxy'), false);
    st.end();

  });
  t.test('Mocked services should use the implementation configuration arguments without complaining they are missing', function(st) {

    awsMock.mock('CloudSearchDomain', 'search', function(params, callback) {
      return callback(null, 'message');
    });

    var csd = new AWS.CloudSearchDomain({
      endpoint: 'some endpoint',
      region: 'eu-west'
    });

    awsMock.mock('CloudSearchDomain', 'suggest', function(params, callback) {
      return callback(null, 'message');
    });

    csd.search({}, function(err, data) {
      st.equals(data, 'message');
    });

    csd.suggest({}, function(err, data) {
      st.equals(data, 'message');
    });
    st.end();
  });
  t.skip('Mocked service should return the sinon stub', function(st) {
    // TODO: the stub is only returned if an instance was already constructed
    var stub = awsMock.mock('CloudSearchDomain', 'search');
    st.equals(stub.stub.isSinonProxy, true);
    st.end();
  });
  t.test('Restore should not fail when the stub did not exist.', function (st) {
    // This test will fail when restoring throws unneeded errors.
    try {
      awsMock.restore('SES', 'sendEmail');
      awsMock.restore('CloudSearchDomain', 'doesnotexist');
      st.end();
    } catch (e) {
      console.log(e);
    }
  });
  t.end();
});

test('AWS.setSDK function should mock a specific AWS module', function(t) {
  t.test('Specific Modules can be set for mocking', function(st) {
    awsMock.setSDK('aws-sdk');
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      st.end();
    });
  });

  t.test('Setting the aws-sdk to the wrong module can cause an exception when mocking', function(st) {
    awsMock.setSDK('sinon');
    st.throws(function() {
      awsMock.mock('SNS', 'publish', 'message');
    });
    awsMock.setSDK('aws-sdk');
    st.end();
  });
  t.end();
});

test('AWS.setSDKInstance function should mock a specific AWS module', function(t) {
  t.test('Specific Modules can be set for mocking', function(st) {
    var aws2 = require('aws-sdk');
    awsMock.setSDKInstance(aws2);
    awsMock.mock('SNS', 'publish', 'message2');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message2');
      st.end();
    });
  });

  t.test('Setting the aws-sdk to the wrong instance can cause an exception when mocking', function(st) {
    var bad = {};
    awsMock.setSDKInstance(bad);
    st.throws(function() {
      awsMock.mock('SNS', 'publish', 'message');
    });
    awsMock.setSDKInstance(AWS);
    st.end();
  });
  t.end();
});
