'use strict';

const tap = require('tap');
const AWS = require('aws-sdk');
const isNodeStream = require('is-node-stream');
const concatStream = require('concat-stream');
const Readable = require('stream').Readable;
const jest = require('jest-mock');
const sinon = require('sinon');

import awsMock = require('../index.ts');

import type { Test } from "tap";
import type { SNS, S3 } from "aws-sdk";


const test = tap.test;

AWS.config.paramValidation = false;

tap.afterEach(() => {
  awsMock.restore();
});

test('AWS.mock function should mock AWS service and method on the service', function(t: Test){
  t.test('mock function replaces method with a function that returns replace string', function(st){
    awsMock.mock('SNS', 'publish', 'message');
    const sns: SNS = new AWS.SNS();
    sns.publish({Message: ''}, function(err, data){
      st.equal(data, 'message');
      st.end();
    });
  });
  t.test('mock function replaces method with replace function', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    const sns: SNS = new AWS.SNS();
    sns.publish({Message: ''}, function(err, data){
      st.equal(data, 'message');
      st.end();
    });
  });
  t.test('method which accepts any number of arguments can be mocked', function(st) {
    awsMock.mock('S3', 'getSignedUrl', 'message');

    const s3 = new AWS.S3();

    s3.getSignedUrl('getObject', {}, function(err: any, data: any) {
      st.equal(data, 'message');
      awsMock.mock('S3', 'upload', function(params, options, callback) {
        callback(null, options);
      });
      s3.upload({Bucket: 'b', Key: 'k' }, {test: 'message'}, function(err: any, data: any) {
        st.equal(data.test, 'message');
        st.end();
      });
    });
  });
  t.test('method fails on invalid input if paramValidation is set', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    const s3: S3 = new AWS.S3({paramValidation: true});
    // We're ignoring because if using typescript, it will complain that `notKey` is not a valid property
    // @ts-ignore
    s3.getObject({Bucket: 'b', notKey: 'k'}, function(err: any, data: any) {
      st.ok(err);
      st.notOk(data);
      st.end();
    });
  });
  t.test('method with no input rules can be mocked even if paramValidation is set', function(st) {
    awsMock.mock('S3', 'getSignedUrl', 'message');
    const s3: S3 = new AWS.S3({paramValidation: true});
    s3.getSignedUrl('getObject', {}, function(err, data) {
      st.equal(data, 'message');
      st.end();
    });
  });
  t.test('method succeeds on valid input when paramValidation is set', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    const s3: S3 = new AWS.S3({paramValidation: true});
    s3.getObject({Bucket: 'b', Key: 'k'}, function(err, data) {
      st.notOk(err);
      st.equal(data.Body, 'body');
      st.end();
    });
  });
  t.test('method is not re-mocked if a mock already exists', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    const sns: SNS = new AWS.SNS();
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'test');
    });
    sns.publish({Message: ''}, function(err, data){
      st.equal(data, 'message');
      st.end();
    });
  });
  t.test('service is not re-mocked if a mock already exists', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    const sns: SNS = new AWS.SNS();
    awsMock.mock('SNS', 'subscribe', function(params, callback){
      callback(null, 'test');
    });
    sns.subscribe({Protocol: "", TopicArn: ""}, function(err, data){
      st.equal(data, 'test');
      st.end();
    });
  });
  t.test('service is re-mocked when remock called', function(st){
    awsMock.mock('SNS', 'subscribe', function(params, callback){
      callback(null, 'message 1');
    });
    const sns: SNS = new AWS.SNS();
    awsMock.remock('SNS', 'subscribe', function(params, callback){
      callback(null, 'message 2');
    });
    sns.subscribe({Protocol: "", TopicArn: ""}, function(err, data){
      st.equal(data, 'message 2');
      st.end();
    });
  });
  t.test('all instances of service are re-mocked when remock called', function(st){
    awsMock.mock('SNS', 'subscribe', function(params, callback){
      callback(null, 'message 1');
    });
    const sns1: SNS = new AWS.SNS();
    const sns2: SNS = new AWS.SNS();

    awsMock.remock('SNS', 'subscribe', function(params, callback){
      callback(null, 'message 2');
    });

    sns1.subscribe({Protocol: "", TopicArn: ""}, function(err, data){
      st.equal(data, 'message 2');

      sns2.subscribe({Protocol: "", TopicArn: ""}, function(err, data){
        st.equal(data, 'message 2');
        st.end();
      });
    });
  });
  t.test('multiple methods can be mocked on the same service', function(st){
    awsMock.mock('Lambda', 'getFunction', function(params, callback) {
      callback(null, 'message');
    });
    awsMock.mock('Lambda', 'createFunction', function(params, callback) {
      callback(null, 'message');
    });
    const lambda = new AWS.Lambda();
    lambda.getFunction({}, function(err: any, data: any) {
      st.equal(data, 'message');
      lambda.createFunction({}, function(err: any, data: any) {
        st.equal(data, 'message');
        st.end();
      });
    });
  });
  if (typeof Promise === 'function') {
    t.test('promises are supported', function(st){
      const error = new Error('on purpose');
      awsMock.mock('Lambda', 'getFunction', function(params, callback) {
        callback(null, 'message');
      });
      awsMock.mock('Lambda', 'createFunction', function(params, callback) {
        callback(error, 'message');
      });
      const lambda = new AWS.Lambda();
      lambda.getFunction({}).promise().then(function(data: any) {
        st.equal(data, 'message');
      }).then(function(){
        return lambda.createFunction({}).promise();
      }).catch(function(data: any){
        st.equal(data, error);
        st.end();
      });
    });
    t.test('replacement returns thennable', function(st){
      const error = new Error('on purpose');
      awsMock.mock('Lambda', 'getFunction', function(params) {
        return Promise.resolve('message')
      });
      awsMock.mock('Lambda', 'createFunction', function(params, callback) {
        return Promise.reject(error)
      });
      const lambda = new AWS.Lambda();
      lambda.getFunction({}).promise().then(function(data: any) {
        st.equal(data, 'message');
      }).then(function(){
        return lambda.createFunction({}).promise();
      }).catch(function(data: any){
        st.equal(data, error);
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
      const S3: S3 = new AWS.S3();
      S3.getObject({Bucket: '', Key: ''}, function(err, data) {});
      st.end();
    });
    t.test('promises work with async completion', function(st){
      const error = new Error('on purpose');
      awsMock.mock('Lambda', 'getFunction', function(this: any, params, callback) {
        setTimeout(callback.bind(this, null, 'message'), 10);
      });
      awsMock.mock('Lambda', 'createFunction', function(this: any, params, callback) {
        setTimeout(callback.bind(this, error, 'message'), 10);
      });
      const lambda = new AWS.Lambda();
      lambda.getFunction({}).promise().then(function(data: any) {
        st.equal(data, 'message');
      }).then(function(){
        return lambda.createFunction({}).promise();
      }).catch(function(data: any){
        st.equal(data, error);
        st.end();
      });
    });
    t.test('promises can be configured', function(st){
      awsMock.mock('Lambda', 'getFunction', function(params, callback) {
        callback(null, 'message');
      });
      const lambda = new AWS.Lambda();
      function P(handler) {
        const self = this;
        function yay (value) {
          self.value = value;
        }
        handler(yay, function(){});
      }
      P.prototype.then = function(yay) { if (this.value) yay(this.value) };
      AWS.config.setPromisesDependency(P);
      const promise = lambda.getFunction({}).promise();
      st.equal(promise.constructor.name, 'P');
      promise.then(function(data) {
        st.equal(data, 'message');
        st.end();
      });
    });
  }
  t.test('request object supports createReadStream', function(st) {
    awsMock.mock('S3', 'getObject', 'body');
    const s3 = new AWS.S3();
    let req = s3.getObject('getObject', function(err, data) {});
    st.ok(isNodeStream(req.createReadStream()));
    // with or without callback
    req = s3.getObject('getObject');
    st.ok(isNodeStream(req.createReadStream()));
    // stream is currently always empty but that's subject to change.
    // let's just consume it and ignore the contents
    req = s3.getObject('getObject');
    const stream = req.createReadStream();
    stream.pipe(concatStream(function() {
      st.end();
    }));
  });
  t.test('request object createReadStream works with streams', function(st) {
    const bodyStream = new Readable();
    bodyStream.push('body');
    bodyStream.push(null);
    awsMock.mock('S3', 'getObject', bodyStream);
    const stream = new AWS.S3().getObject('getObject').createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equal(actual.toString(), 'body');
      st.end();
    }));
  });
  t.test('request object createReadStream works with returned streams', function(st) {
    awsMock.mock('S3', 'getObject', () => {
      const bodyStream = new Readable();
      bodyStream.push('body');
      bodyStream.push(null);
      return bodyStream;
    });
    const stream = new AWS.S3().getObject('getObject').createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equal(actual.toString(), 'body');
      st.end();
    }));
  });
  t.test('request object createReadStream works with strings', function(st) {
    awsMock.mock('S3', 'getObject', 'body');
    const s3 = new AWS.S3();
    const req = s3.getObject('getObject', {});
    const stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equal(actual.toString(), 'body');
      st.end();
    }));
  });
  t.test('request object createReadStream works with buffers', function(st) {
    awsMock.mock('S3', 'getObject', Buffer.alloc(4, 'body'));
    const s3 = new AWS.S3();
    const req = s3.getObject('getObject', {});
    const stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equal(actual.toString(), 'body');
      st.end();
    }));
  });
  t.test('request object createReadStream ignores functions', function(st) {
    awsMock.mock('S3', 'getObject', function(){});
    const s3 = new AWS.S3();
    const req = s3.getObject('getObject', {});
    const stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equal(actual.toString(), '');
      st.end();
    }));
  });
  t.test('request object createReadStream ignores non-buffer objects', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    const s3 = new AWS.S3();
    const req = s3.getObject('getObject', {});
    const stream = req.createReadStream();
    stream.pipe(concatStream(function(actual) {
      st.equal(actual.toString(), '');
      st.end();
    }));
  });
  t.test('call on method of request object', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    const s3 = new AWS.S3();
    const req = s3.getObject('getObject', {});
    st.equal(typeof req.on, 'function');
    st.end();
  });
  t.test('call send method of request object', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    const s3 = new AWS.S3();
    const req = s3.getObject('getObject', {});
    st.equal(typeof req.send, 'function');
    st.end();
  });
  t.test('all the methods on a service are restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    st.equal(AWS.SNS.isSinonProxy, true);

    awsMock.restore('SNS');

    st.equal(AWS.SNS.hasOwnProperty('isSinonProxy'), false);
    st.end();
  });
  t.test('only the method on the service is restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });
    const sns = new AWS.SNS();
    st.equal(AWS.SNS.isSinonProxy, true);
    st.equal(sns.publish.isSinonProxy, true);

    awsMock.restore('SNS', 'publish');

    st.equal(AWS.SNS.hasOwnProperty('isSinonProxy'), true);
    st.equal(sns.publish.hasOwnProperty('isSinonProxy'), false);
    st.end();
  });
  t.test('method on all service instances are restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });

    const sns1 = new AWS.SNS();
    const sns2 = new AWS.SNS();

    st.equal(AWS.SNS.isSinonProxy, true);
    st.equal(sns1.publish.isSinonProxy, true);
    st.equal(sns2.publish.isSinonProxy, true);

    awsMock.restore('SNS', 'publish');

    st.equal(AWS.SNS.hasOwnProperty('isSinonProxy'), true);
    st.equal(sns1.publish.hasOwnProperty('isSinonProxy'), false);
    st.equal(sns2.publish.hasOwnProperty('isSinonProxy'), false);
    st.end();
  });
  t.test('all methods on all service instances are restored', function(st){
    awsMock.mock('SNS', 'publish', function(params, callback){
      callback(null, 'message');
    });

    const sns1 = new AWS.SNS();
    const sns2 = new AWS.SNS();

    st.equal(AWS.SNS.isSinonProxy, true);
    st.equal(sns1.publish.isSinonProxy, true);
    st.equal(sns2.publish.isSinonProxy, true);

    awsMock.restore('SNS');

    st.equal(AWS.SNS.hasOwnProperty('isSinonProxy'), false);
    st.equal(sns1.publish.hasOwnProperty('isSinonProxy'), false);
    st.equal(sns2.publish.hasOwnProperty('isSinonProxy'), false);
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
    const sns = new AWS.SNS();
    const docClient = new AWS.DynamoDB.DocumentClient();
    const dynamoDb = new AWS.DynamoDB();

    st.equal(AWS.SNS.isSinonProxy, true);
    st.equal(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equal(AWS.DynamoDB.isSinonProxy, true);
    st.equal(sns.publish.isSinonProxy, true);
    st.equal(docClient.put.isSinonProxy, true);
    st.equal(dynamoDb.putItem.isSinonProxy, true);

    awsMock.restore();

    st.equal(AWS.SNS.hasOwnProperty('isSinonProxy'), false);
    st.equal(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy'), false);
    st.equal(AWS.DynamoDB.hasOwnProperty('isSinonProxy'), false);
    st.equal(sns.publish.hasOwnProperty('isSinonProxy'), false);
    st.equal(docClient.put.hasOwnProperty('isSinonProxy'), false);
    st.equal(dynamoDb.putItem.hasOwnProperty('isSinonProxy'), false);
    st.end();
  });
  t.test('a nested service can be mocked properly', function(st){
    awsMock.mock('DynamoDB.DocumentClient', 'put', 'message');
    const docClient = new AWS.DynamoDB.DocumentClient();
    awsMock.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
      callback(null, 'test');
    });
    awsMock.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
      callback(null, 'test');
    });

    st.equal(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equal(docClient.put.isSinonProxy, true);
    st.equal(docClient.get.isSinonProxy, true);

    docClient.put({}, function(err, data){
      st.equal(data, 'message');
      docClient.get({}, function(err, data){
        st.equal(data, 'test');

        awsMock.restore('DynamoDB.DocumentClient', 'get');
        st.equal(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
        st.equal(docClient.get.hasOwnProperty('isSinonProxy'), false);

        awsMock.restore('DynamoDB.DocumentClient');
        st.equal(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy'), false);
        st.equal(docClient.put.hasOwnProperty('isSinonProxy'), false);
        st.end();
      });
    });
  });
  t.test('a nested service can be mocked properly even when paramValidation is set', function(st){
    awsMock.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
      callback(null, 'test');
    });
    const docClient = new AWS.DynamoDB.DocumentClient({paramValidation: true});

    st.equal(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equal(docClient.query.isSinonProxy, true);
    docClient.query({}, function(err, data){
      st.equal(err, null);
      st.equal(data, 'test');
      st.end();
    });
  });
  t.test('a mocked service and a mocked nested service can coexist as long as the nested service is mocked first', function(st) {
    awsMock.mock('DynamoDB.DocumentClient', 'get', 'message');
    awsMock.mock('DynamoDB', 'getItem', 'test');
    const docClient = new AWS.DynamoDB.DocumentClient();
    let dynamoDb = new AWS.DynamoDB();

    st.equal(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equal(AWS.DynamoDB.isSinonProxy, true);
    st.equal(docClient.get.isSinonProxy, true);
    st.equal(dynamoDb.getItem.isSinonProxy, true);

    awsMock.restore('DynamoDB');
    st.equal(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equal(AWS.DynamoDB.hasOwnProperty('isSinonProxy'), false);
    st.equal(docClient.get.isSinonProxy, true);
    st.equal(dynamoDb.getItem.hasOwnProperty('isSinonProxy'), false);

    awsMock.mock('DynamoDB', 'getItem', 'test');
    dynamoDb = new AWS.DynamoDB();
    st.equal(AWS.DynamoDB.DocumentClient.isSinonProxy, true);
    st.equal(AWS.DynamoDB.isSinonProxy, true);
    st.equal(docClient.get.isSinonProxy, true);
    st.equal(dynamoDb.getItem.isSinonProxy, true);

    awsMock.restore('DynamoDB.DocumentClient');

    // the first assertion is true because DynamoDB is still mocked
    st.equal(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy'), true);
    st.equal(AWS.DynamoDB.isSinonProxy, true);
    st.equal(docClient.get.hasOwnProperty('isSinonProxy'), false);
    st.equal(dynamoDb.getItem.isSinonProxy, true);

    awsMock.restore('DynamoDB');
    st.equal(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy'), false);
    st.equal(AWS.DynamoDB.hasOwnProperty('isSinonProxy'), false);
    st.equal(docClient.get.hasOwnProperty('isSinonProxy'), false);
    st.equal(dynamoDb.getItem.hasOwnProperty('isSinonProxy'), false);
    st.end();

  });
  t.test('Mocked services should use the implementation configuration arguments without complaining they are missing', function(st) {

    awsMock.mock('CloudSearchDomain', 'search', function(params, callback) {
      return callback(null, 'message');
    });

    const csd = new AWS.CloudSearchDomain({
      endpoint: 'some endpoint',
      region: 'eu-west'
    });

    awsMock.mock('CloudSearchDomain', 'suggest', function(params, callback) {
      return callback(null, 'message');
    });

    csd.search({}, function(err, data) {
      st.equal(data, 'message');
    });

    csd.suggest({}, function(err, data) {
      st.equal(data, 'message');
    });
    st.end();
  });
  t.skip('Mocked service should return the sinon stub', function(st) {
    // TODO: the stub is only returned if an instance was already constructed
    const stub = awsMock.mock('CloudSearchDomain', 'search');
    st.equal(stub.stub.isSinonProxy, true);
    st.end();
  });

  t.test('Restore should not fail when the stub did not exist.', function (st) {
    // This test will fail when restoring throws unneeded errors.
    try {
      awsMock.restore('Lambda');
      awsMock.restore('SES', 'sendEmail');
      awsMock.restore('CloudSearchDomain', 'doesnotexist');
      st.end();
    } catch (e) {
      console.log(e);
    }
  });

  t.test('Restore should not fail when service was not mocked', function (st) {
    // This test will fail when restoring throws unneeded errors.
    try {
      awsMock.restore('CloudFormation');
      awsMock.restore('UnknownService');
      st.end();
    } catch (e) {
      console.log(e);
    }
  });

  t.test('Mocked service should allow chained calls after listening to events', function (st) {
    awsMock.mock('S3', 'getObject');
    const s3 = new AWS.S3();
    const req = s3.getObject({Bucket: 'b', notKey: 'k'});
    st.equal(req.on('httpHeaders', ()=>{}), req);
    st.end();
  });

  t.test('Mocked service should return replaced function when request send is called', function(st) {
    awsMock.mock('S3', 'getObject', {Body: 'body'});
    let returnedValue = '';
    const s3 = new AWS.S3();
    const req = s3.getObject('getObject', {});
    req.send(async (err, data) => {
      returnedValue = data.Body;
    });
    st.equal(returnedValue, 'body');
    st.end();
  });

  t.test('mock function replaces method with a sinon stub and returns successfully using callback', function(st) {
    const sinonStub = sinon.stub();
    sinonStub.returns('message');
    awsMock.mock('DynamoDB', 'getItem', sinonStub);
    const db = new AWS.DynamoDB();
    db.getItem({}, function(err, data){
      st.equal(data, 'message');
      st.equal(sinonStub.called, true);
      st.end();
    });
  });

  t.test('mock function replaces method with a sinon stub and returns successfully using promise', function(st) {
    const sinonStub = sinon.stub();
    sinonStub.returns('message');
    awsMock.mock('DynamoDB', 'getItem', sinonStub);
    const db = new AWS.DynamoDB();
    db.getItem({}).promise().then(function(data){
      st.equal(data, 'message');
      st.equal(sinonStub.called, true);
      st.end();
    });
  });

  t.test('mock function replaces method with a jest mock and returns successfully', function(st) {
    const jestMock = jest.fn().mockReturnValue('message');
    awsMock.mock('DynamoDB', 'getItem', jestMock);
    const db = new AWS.DynamoDB();
    db.getItem({}, function(err, data){
      st.equal(data, 'message');
      st.equal(jestMock.mock.calls.length, 1);
      st.end();
    });
  });

  t.test('mock function replaces method with a jest mock returning successfully and allows mocked method to be called with only callback', function(st) {
    const jestMock = jest.fn().mockReturnValue('message');
    awsMock.mock('DynamoDB', 'getItem', jestMock);
    const db = new AWS.DynamoDB();
    db.getItem(function(err, data){
      st.equal(data, 'message');
      st.equal(jestMock.mock.calls.length, 1);
      st.end();
    });
  });

  t.test('mock function replaces method with a jest mock and resolves successfully', function(st) {
    const jestMock = jest.fn().mockResolvedValue('message');
    awsMock.mock('DynamoDB', 'getItem', jestMock);
    const db = new AWS.DynamoDB();
    db.getItem({}, function(err, data){
      st.equal(data, 'message');
      st.equal(jestMock.mock.calls.length, 1);
      st.end();
    });
  });

  t.test('mock function replaces method with a jest mock and fails successfully', function(st) {
    const jestMock = jest.fn(() => {
      throw new Error('something went wrong')
    });
    awsMock.mock('DynamoDB', 'getItem', jestMock);
    const db = new AWS.DynamoDB();
    db.getItem({}, function(err){
      st.equal(err.message, 'something went wrong');
      st.equal(jestMock.mock.calls.length, 1);
      st.end();
    });
  });

  t.test('mock function replaces method with a jest mock and rejects successfully', function(st) {
    const jestMock = jest.fn().mockRejectedValue(new Error('something went wrong'));
    awsMock.mock('DynamoDB', 'getItem', jestMock);
    const db = new AWS.DynamoDB();
    db.getItem({}, function(err){
      st.equal(err.message, 'something went wrong');
      st.equal(jestMock.mock.calls.length, 1);
      st.end();
    });
  });

  t.test('mock function replaces method with a jest mock with implementation', function(st) {
    const jestMock = jest.fn((params, cb) => cb(null, 'item'));
    awsMock.mock('DynamoDB', 'getItem', jestMock);
    const db = new AWS.DynamoDB();
    db.getItem({}, function(err, data){
      st.equal(jestMock.mock.calls.length, 1);
      st.equal(data, 'item');
      st.end();
    });
  });

  t.test('mock function replaces method with a jest mock with implementation and allows mocked method to be called with only callback', function(st) {
    const jestMock = jest.fn((params, cb) => cb(null, 'item'));
    awsMock.mock('DynamoDB', 'getItem', jestMock);
    const db = new AWS.DynamoDB();
    db.getItem(function(err, data){
      st.equal(jestMock.mock.calls.length, 1);
      st.equal(data, 'item');
      st.end();
    });
  });

  t.test('mock function replaces method with a jest mock with implementation expecting only a callback', function(st) {
    const jestMock = jest.fn((cb) => cb(null, 'item'));
    awsMock.mock('DynamoDB', 'getItem', jestMock);
    const db = new AWS.DynamoDB();
    db.getItem(function(err, data){
      st.equal(jestMock.mock.calls.length, 1);
      st.equal(data, 'item');
      st.end();
    });
  });

  t.test('Mocked service should allow abort call', function (st) {
    awsMock.mock('S3', 'upload');
    const s3 = new AWS.S3();
    const req = s3.upload({}, {message: 'test'});
    req.abort();
    st.end();
  });

  t.end();
});

test('AWS.setSDK function should mock a specific AWS module', function(t: Test) {
  t.test('Specific Modules can be set for mocking', function(st) {
    awsMock.setSDK('aws-sdk');
    awsMock.mock('SNS', 'publish', 'message');
    const sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equal(data, 'message');
      st.end();
    });
  });

  t.test('Modules with multi-parameter constructors can be set for mocking', function(st) {
    awsMock.setSDK('aws-sdk');
    awsMock.mock('CloudFront.Signer', 'getSignedUrl');
    const signer = new AWS.CloudFront.Signer('key-pair-id', 'private-key');
    st.type(signer, 'Signer');
    st.end();
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

test('AWS.setSDKInstance function should mock a specific AWS module', function(t: Test) {
  t.test('Specific Modules can be set for mocking', function(st) {
    const aws2 = require('aws-sdk');
    awsMock.setSDKInstance(aws2);
    awsMock.mock('SNS', 'publish', 'message2');
    const sns = new AWS.SNS();
    sns.publish({}, function(err, data){
      st.equal(data, 'message2');
      st.end();
    });
  });

  t.test('Setting the aws-sdk to the wrong instance can cause an exception when mocking', function(st) {
    const bad = {};
    awsMock.setSDKInstance(bad);
    st.throws(function() {
      awsMock.mock('SNS', 'publish', 'message');
    });
    awsMock.setSDKInstance(AWS);
    st.end();
  });
  t.end();
});
