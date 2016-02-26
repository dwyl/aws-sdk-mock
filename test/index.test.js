var test     = require('tape');
var awsMock = require('../index.js');
var AWS      = require('aws-sdk');

test('AWS.mock function should mock AWS service and method on the service', function(t){
  t.test('mock function replaces method with a function that returns replace string', function(st){
    awsMock.mock('SNS', 'publish', 'message');
    var sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equals(data, 'message');
      awsMock.restore('SNS');
      st.end();
    })
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
    })
  })
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
    })
  })
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
    })
  })
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
      })
    });
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
  })
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
  })
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
  })
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
    })
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
  })
  t.end();
});
