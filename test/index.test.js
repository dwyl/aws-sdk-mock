var test     = require('tape');
var awsMock = require('../index.js');
var AWS      = require('aws-sdk');
var isNodeStream = require('is-node-stream');
var concatStream = require('concat-stream');

AWS.config.paramValidation = false;

test('AWS.mock function should mock AWS service and method on the service', function(t){
  t.test('mock function replaces method with a function that returns replace string', function(st){
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
      st.end();
    });
  });
  t.test('mock function replaces method with replace function', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
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
        awsMock.restore('S3');
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
      awsMock.restore('S3', 'getObject');
      st.end();
    });
  });
  t.test('method with no input rules can be mocked even if paramValidation is set', function(st) {
    awsMock.mock('S3', 'getSignedUrl', 'message');
    var s3 = new AWS.S3({paramValidation: true});
    s3.getSignedUrl('getObject', {}, function(err, data) {
      st.equals(data, 'message');
      awsMock.restore('S3');
      st.end();
    });
  });
  t.test('method succeeds on valid input when paramValidation is set', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    var s3 = new AWS.S3({paramValidation: true});
    s3.getObject({Bucket: 'b', Key: 'k'}, function(err, data) {
      st.notOk(err);
      st.equals(data.Body, 'body');
      awsMock.restore('S3', 'getObject');
      st.end();
    });
  });
  t.test('method is not re-mocked if a mock already exists', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "test");
    });
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
      st.end();
    });
  });
  t.test('service is not re-mocked if a mock already exists', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    awsMock.mock('SNS', 'subscribe', function(params, callback){
      callback(null, "test");
    });
    sns.subscribe({}, function(err, data){
      st.equals(data, 'test');
      awsMock.restore('SNS');
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
      awsMock.restore('Lambda', 'getFunction');
      awsMock.restore('Lambda', 'createFunction');
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
      awsMock.restore('Lambda', 'getFunction');
      awsMock.restore('Lambda', 'createFunction');
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
      awsMock.restore('Lambda', 'getFunction');
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
      awsMock.restore('S3', 'getObject');
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
      awsMock.restore('S3', 'getObject');
      st.end();
    }));
  });
  t.test('request object createReadStream works with buffers', function(st) {
    awsMock.mock('S3', 'getObject', new Buffer('body'));
    var s3 = new AWS.S3();
    var req = s3.getObject('getObject', {});
    var stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equals(actual.toString(), 'body');
      awsMock.restore('S3', 'getObject');
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
      awsMock.restore('S3', 'getObject');
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
      awsMock.restore('S3', 'getObject');
      st.end();
    }));
  });
  t.test('all the methods on a service are restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
    });
    var sns = new AWS.SNS();
    st.equals(AWS.SNS.isSinonProxy, true);

    awsMock.restore('SNS');

    st.equals(AWS.SNS.hasOwnProperty('isSinonProxy'), false);
    st.end();
  });
  t.test('only the method on the service is restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, "message");
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
      callback(null, "message");
    });
    awsMock.mock('DynamoDB', 'putItem', function(params, callback){
      callback(null, "test");
    });
    awsMock.mock('DynamoDB.DocumentClient', 'put', function(params, callback){
      callback(null, "test");
    });
    var sns      = new AWS.SNS();
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
      awsMock.restore('DynamoDB.DocumentClient', 'query');
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
    var dynamoDb = new AWS.DynamoDB();
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
  t.test('Mocked service should return the sinon stub', function(st) {
    var stub = awsMock.mock('CloudSearchDomain', 'search');
    st.equals(stub.stub.isSinonProxy, true);
    st.end();
  });
  t.end();
  t.test('Restore should not fail when the stub did not exist.', function (st) {
    // This test will fail when restoring throws unneeded errors.
    try {
      var stub = awsMock.mock('CloudSearchDomain', 'search');
      awsMock.restore('SES', 'sendEmail');
      awsMock.restore('CloudSearchDomain', 'doesnotexist');
      st.end();
    } catch (e) {
      console.log(e);
    }

  });
});

test('AWS.setSDK function should mock a specific AWS module', function(t) {
  t.test('Specific Modules can be set for mocking', function(st) {
    awsMock.setSDK('aws-sdk');
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
      st.end();
    });
  });

  t.test('Setting the aws-sdk to the wrong module can cause an exception when mocking', function(st) {
    awsMock.setSDK('sinon');
    st.throws(function() {
      awsMock.mock('SNS', 'publish', 'message');
    });
    awsMock.setSDK('aws-sdk');
    awsMock.restore();

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
      awsMock.restore('SNS');
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
    awsMock.restore();
    st.end();
  });
  t.end();
});
