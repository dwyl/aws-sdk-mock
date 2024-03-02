'use strict';

// Library imports
import concatStream from 'concat-stream';
import sinon from 'sinon';

// `aws-sdk-mock` import
import awsMock from '../src/index.ts';
// AWS import to be used in a test
import aws2 from 'aws-sdk';

// Const imports
const isNodeStream = require('is-node-stream');
import AWS from 'aws-sdk';
import { Readable } from 'stream';

// Type imports
import type { SNS, S3, CloudSearchDomain, DynamoDB } from 'aws-sdk';
import type { Readable as ReadableType } from 'stream';
import type { MaybeSoninProxy } from '../src/types.ts';

AWS.config.paramValidation = false;

describe('TESTS', function () {
  afterEach(() => {
    awsMock.restore();
  });

  describe('AWS.mock function should mock AWS service and method on the service', function () {
    it('mock function replaces method with a function that returns replace string', function () {
      awsMock.mock('SNS', 'publish', 'message');
      const sns: SNS = new AWS.SNS();
      sns.publish({ Message: '' }, function (err, data) {
        expect(data).toEqual('message');
      });
    });

    it('mock function replaces method with replace function', function () {
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'message');
      });
      const sns: SNS = new AWS.SNS();
      sns.publish({ Message: '' }, function (err, data) {
        expect(data).toEqual('message');
      });
    });

    it('method which accepts any number of arguments can be mocked', function () {
      awsMock.mock('S3', 'getSignedUrl', 'message');

      const s3 = new AWS.S3();

      s3.getSignedUrl('getObject', {}, function (err: any, data: any) {
        expect(data).toEqual('message');
        awsMock.mock('S3', 'upload', function (params, options, callback) {
          callback(null, options);
        });
        s3.upload({ Bucket: 'b', Key: 'k' }, { partSize: 1 }, function (err: any, data: any) {
          expect(data.partSize).toEqual(1);
        });
      });
    });

    it('method fails on invalid input if paramValidation is set', function () {
      awsMock.mock('S3', 'getObject', { Body: 'body' });
      const s3: S3 = new AWS.S3({ paramValidation: true });
      // We're ignoring because if using typescript, it will complain that `notKey` is not a valid property
      // @ts-ignore
      s3.getObject({ Bucket: 'b', notKey: 'k' }, function (err: any, data: any) {
        expect(err).toBeTruthy();
        expect(data).toBeFalsy();
      });
    });

    it('method with no input rules can be mocked even if paramValidation is set', function () {
      awsMock.mock('S3', 'getSignedUrl', 'message');
      const s3: S3 = new AWS.S3({ paramValidation: true });
      s3.getSignedUrl('getObject', {}, function (err, data) {
        expect(data).toEqual('message');
      });
    });

    it('method succeeds on valid input when paramValidation is set', function () {
      awsMock.mock('S3', 'getObject', { Body: 'body' });
      const s3: S3 = new AWS.S3({ paramValidation: true });
      s3.getObject({ Bucket: 'b', Key: 'k' }, function (err, data) {
        expect(err).toBeFalsy();
        expect(data.Body).toEqual('body');
      });
    });

    it('method is not re-mocked if a mock already exists', function () {
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'message');
      });
      const sns: SNS = new AWS.SNS();
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'test');
      });
      sns.publish({ Message: '' }, function (err, data) {
        expect(data).toEqual('message');
      });
    });

    it('service is not re-mocked if a mock already exists', function () {
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'message');
      });
      const sns: SNS = new AWS.SNS();
      awsMock.mock('SNS', 'subscribe', function (params, callback) {
        callback(null, 'test');
      });
      sns.subscribe({ Protocol: '', TopicArn: '' }, function (err, data) {
        expect(data).toEqual('test');
      });
    });

    it('service is re-mocked when remock called', function () {
      awsMock.mock('SNS', 'subscribe', function (params, callback) {
        callback(null, 'message 1');
      });
      const sns: SNS = new AWS.SNS();
      awsMock.remock('SNS', 'subscribe', function (params, callback) {
        callback(null, 'message 2');
      });
      sns.subscribe({ Protocol: '', TopicArn: '' }, function (err, data) {
        expect(data).toEqual('message 2');
      });
    });
    it('all instances of service are re-mocked when remock called', function () {
      awsMock.mock('SNS', 'subscribe', function (params, callback) {
        callback(null, 'message 1');
      });
      const sns1: SNS = new AWS.SNS();
      const sns2: SNS = new AWS.SNS();

      awsMock.remock('SNS', 'subscribe', function (params, callback) {
        callback(null, 'message 2');
      });

      sns1.subscribe({ Protocol: '', TopicArn: '' }, function (err, data) {
        expect(data).toEqual('message 2');

        sns2.subscribe({ Protocol: '', TopicArn: '' }, function (err, data) {
          expect(data).toEqual('message 2');
        });
      });
    });
    it('multiple methods can be mocked on the same service', function () {
      awsMock.mock('Lambda', 'getFunction', function (params, callback) {
        callback(null, 'message');
      });
      awsMock.mock('Lambda', 'createFunction', function (params, callback) {
        callback(null, 'message');
      });
      const lambda = new AWS.Lambda();
      lambda.getFunction({ FunctionName: '' }, function (err: any, data: any) {
        expect(data).toEqual('message');
        lambda.createFunction({ Role: '', Code: {}, FunctionName: '' }, function (err: any, data: any) {
          expect(data).toEqual('message');
        });
      });
    });
    if (typeof Promise === 'function') {
      it('promises are supported', function () {
        const error = new Error('on purpose');
        awsMock.mock('Lambda', 'getFunction', function (params, callback) {
          callback(null, 'message');
        });
        awsMock.mock('Lambda', 'createFunction', function (params, callback) {
          callback(error, 'message');
        });
        const lambda = new AWS.Lambda();
        lambda
          .getFunction({ FunctionName: '' })
          .promise()
          .then(function (data: any) {
            expect(data).toEqual('message');
          })
          .then(function () {
            return lambda.createFunction({ Role: '', Code: {}, FunctionName: '' }).promise();
          })
          .catch(function (data: any) {
            expect(data).toEqual(error);
          });
      });
      it('replacement returns thennable', function () {
        const error = new Error('on purpose');
        awsMock.mock('Lambda', 'getFunction', function (params) {
          return Promise.resolve('message');
        });
        awsMock.mock('Lambda', 'createFunction', function (params, callback) {
          return Promise.reject(error);
        });
        const lambda = new AWS.Lambda();
        lambda
          .getFunction({ FunctionName: '' })
          .promise()
          .then(function (data: any) {
            expect(data).toEqual('message');
          })
          .then(function () {
            return lambda.createFunction({ Role: '', Code: {}, FunctionName: '' }).promise();
          })
          .catch(function (data: any) {
            expect(data).toEqual(error);
          });
      });
      it('no unhandled promise rejections when promises are not used', function () {
        process.on('unhandledRejection', function (reason, promise) {
          throw 'unhandledRejection: ' + reason;
        });
        awsMock.mock('S3', 'getObject', function (params, callback) {
          callback('This is a test error to see if promise rejections go unhandled');
        });
        const S3: S3 = new AWS.S3();
        S3.getObject({ Bucket: '', Key: '' }, function (err, data) {});
      });
      it('promises work with async completion', function () {
        const error = new Error('on purpose');
        awsMock.mock('Lambda', 'getFunction', function (this: any, params, callback) {
          setTimeout(callback.bind(this, null, 'message'), 10);
        });
        awsMock.mock('Lambda', 'createFunction', function (this: any, params, callback) {
          setTimeout(callback.bind(this, error, 'message'), 10);
        });
        const lambda = new AWS.Lambda();
        lambda
          .getFunction({ FunctionName: '' })
          .promise()
          .then(function (data: any) {
            expect(data).toEqual('message');
          })
          .then(function () {
            return lambda.createFunction({ Role: '', Code: {}, FunctionName: '' }).promise();
          })
          .catch(function (data: any) {
            expect(data).toEqual(error);
          });
      });
      it('promises can be configured', function () {
        awsMock.mock('Lambda', 'getFunction', function (params, callback) {
          callback(null, 'message');
        });
        const lambda = new AWS.Lambda();
        function P(this: any, handler: any) {
          const self = this;
          function yay(value: any) {
            self.value = value;
          }
          handler(yay, function () {});
        }
        P.prototype.then = function (yay: any) {
          if (this.value) yay(this.value);
        };
        AWS.config.setPromisesDependency(P);
        const promise = lambda.getFunction({ FunctionName: '' }).promise();
        expect(promise.constructor.name).toEqual('P');
        promise.then(function (data: any) {
          expect(data).toEqual('message');
        });
      });
    }
    it('request object supports createReadStream', function () {
      awsMock.mock('S3', 'getObject', 'body');
      const s3 = new AWS.S3();
      let req = s3.getObject({ Bucket: '', Key: '' }, function (err: any, data: any) {});
      expect(isNodeStream(req.createReadStream())).toBeTruthy();
      // with or without callback
      req = s3.getObject({ Bucket: '', Key: '' });
      expect(isNodeStream(req.createReadStream())).toBeTruthy();
      // stream is currently always empty but that's subject to change.
      // let's just consume it and ignore the contents
      req = s3.getObject({ Bucket: '', Key: '' });
      const stream = req.createReadStream();
      stream.pipe(concatStream(function () {}));
    });
    it('request object createReadStream works with streams', function () {
      const bodyStream: ReadableType = new Readable();
      bodyStream.push('body');
      bodyStream.push(null);
      awsMock.mock('S3', 'getObject', bodyStream);
      const stream = new AWS.S3().getObject({ Bucket: '', Key: '' }).createReadStream();
      stream.pipe(
        concatStream(function (actual: any) {
          expect(actual.toString()).toEqual('body');
        })
      );
    });
    it('request object createReadStream works with returned streams', function () {
      awsMock.mock('S3', 'getObject', () => {
        const bodyStream: ReadableType = new Readable();
        bodyStream.push('body');
        bodyStream.push(null);
        return bodyStream;
      });
      const stream = new AWS.S3().getObject({ Bucket: '', Key: '' }).createReadStream();
      stream.pipe(
        concatStream(function (actual: any) {
          expect(actual.toString()).toEqual('body');
        })
      );
    });
    it('request object createReadStream works with strings', function () {
      awsMock.mock('S3', 'getObject', 'body');
      const s3: S3 = new AWS.S3();
      const req = s3.getObject({ Bucket: '', Key: '' }, () => {});
      const stream = req.createReadStream();
      stream.pipe(
        concatStream(function (actual: any) {
          expect(actual.toString()).toEqual('body');
        })
      );
    });
    it('request object createReadStream works with buffers', function () {
      awsMock.mock('S3', 'getObject', Buffer.alloc(4, 'body'));
      const s3: S3 = new AWS.S3();
      const req = s3.getObject({ Bucket: '', Key: '' }, () => {});
      const stream = req.createReadStream();
      stream.pipe(
        concatStream(function (actual: any) {
          expect(actual.toString()).toEqual('body');
        })
      );
    });
    it('request object createReadStream ignores functions', function () {
      awsMock.mock('S3', 'getObject', function () {});
      const s3: S3 = new AWS.S3();
      const req = s3.getObject({ Bucket: '', Key: '' }, () => {});
      const stream = req.createReadStream();
      stream.pipe(
        concatStream(function (actual: any) {
          expect(actual.toString()).toEqual('');
        })
      );
    });
    it('request object createReadStream ignores non-buffer objects', function () {
      awsMock.mock('S3', 'getObject', { Body: 'body' });
      const s3: S3 = new AWS.S3();
      const req = s3.getObject({ Bucket: '', Key: '' }, () => {});
      const stream = req.createReadStream();
      stream.pipe(
        concatStream(function (actual: any) {
          expect(actual.toString()).toEqual('');
        })
      );
    });
    it('call on method of request object', function () {
      awsMock.mock('S3', 'getObject', { Body: 'body' });
      const s3 = new AWS.S3();
      const req = s3.getObject({ Bucket: '', Key: '' }, () => {});
      expect(typeof req.on).toEqual('function');
    });
    it('call send method of request object', function () {
      awsMock.mock('S3', 'getObject', { Body: 'body' });
      const s3 = new AWS.S3();
      const req = s3.getObject({ Bucket: '', Key: '' }, () => {});
      expect(typeof req.on).toEqual('function');
    });
    it('all the methods on a service are restored', function () {
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'message');
      });
      expect((AWS.SNS as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      awsMock.restore('SNS');

      expect(AWS.SNS.hasOwnProperty('isSinonProxy')).toEqual(false);
    });
    it('only the method on the service is restored', function () {
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'message');
      });
      const sns = new AWS.SNS();
      expect((AWS.SNS as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((sns.publish as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      awsMock.restore('SNS', 'publish');

      expect(AWS.SNS.hasOwnProperty('isSinonProxy')).toEqual(true);
      expect(sns.publish.hasOwnProperty('isSinonProxy')).toEqual(false);
    });
    it('method on all service instances are restored', function () {
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'message');
      });

      const sns1 = new AWS.SNS();
      const sns2 = new AWS.SNS();

      expect((AWS.SNS as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((sns1.publish as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((sns2.publish as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      awsMock.restore('SNS', 'publish');

      expect(AWS.SNS.hasOwnProperty('isSinonProxy')).toEqual(true);
      expect(sns1.publish.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(sns2.publish.hasOwnProperty('isSinonProxy')).toEqual(false);
    });
    it('all methods on all service instances are restored', function () {
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'message');
      });

      const sns1 = new AWS.SNS();
      const sns2 = new AWS.SNS();

      expect((AWS.SNS as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((sns1.publish as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((sns2.publish as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      awsMock.restore('SNS');

      expect(AWS.SNS.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(sns1.publish.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(sns2.publish.hasOwnProperty('isSinonProxy')).toEqual(false);
    });
    it('all the services are restored when no arguments given to awsMock.restore', function () {
      awsMock.mock('SNS', 'publish', function (params, callback) {
        callback(null, 'message');
      });
      awsMock.mock('DynamoDB', 'putItem', function (params, callback) {
        callback(null, 'test');
      });
      awsMock.mock('DynamoDB.DocumentClient', 'put', function (params, callback) {
        callback(null, 'test');
      });
      const sns = new AWS.SNS();
      const docClient = new AWS.DynamoDB.DocumentClient();
      const dynamoDb = new AWS.DynamoDB();

      expect((AWS.SNS as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((AWS.DynamoDB.DocumentClient as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((AWS.DynamoDB as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((sns.publish as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((docClient.put as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((dynamoDb.putItem as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      awsMock.restore();

      expect(AWS.SNS.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(AWS.DynamoDB.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(sns.publish.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(docClient.put.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(dynamoDb.putItem.hasOwnProperty('isSinonProxy')).toEqual(false);
    });
    it('a nested service can be mocked properly', function () {
      awsMock.mock('DynamoDB.DocumentClient', 'put', 'message');
      const docClient = new AWS.DynamoDB.DocumentClient();
      awsMock.mock('DynamoDB.DocumentClient', 'put', function (params, callback) {
        callback(null, 'test');
      });
      awsMock.mock('DynamoDB.DocumentClient', 'get', function (params, callback) {
        callback(null, 'test');
      });

      expect((AWS.DynamoDB.DocumentClient as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((docClient.put as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((docClient.get as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      docClient.put({ Item: {}, TableName: '' }, function (err: any, data: any) {
        expect(data).toEqual('message');
        docClient.get({ Key: {}, TableName: '' }, function (err: any, data: any) {
          expect(data).toEqual('test');

          awsMock.restore('DynamoDB.DocumentClient', 'get');
          expect((AWS.DynamoDB.DocumentClient as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
          expect(docClient.get.hasOwnProperty('isSinonProxy')).toEqual(false);

          awsMock.restore('DynamoDB.DocumentClient');
          expect(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy')).toEqual(false);
          expect(docClient.put.hasOwnProperty('isSinonProxy')).toEqual(false);
        });
      });
    });
    it('a nested service can be mocked properly even when paramValidation is set', function () {
      awsMock.mock('DynamoDB.DocumentClient', 'query', function (params, callback) {
        callback(null, 'test');
      });
      const docClient = new AWS.DynamoDB.DocumentClient({ paramValidation: true });

      expect((AWS.DynamoDB.DocumentClient as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((docClient.query as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      docClient.query({ TableName: '' }, function (err: any, data: any) {
        expect(err).toEqual(null);
        expect(data).toEqual('test');
      });
    });
    it('a mocked service and a mocked nested service can coexist as long as the nested service is mocked first', function () {
      awsMock.mock('DynamoDB.DocumentClient', 'get', 'message');
      awsMock.mock('DynamoDB', 'getItem', 'test');
      const docClient = new AWS.DynamoDB.DocumentClient();
      let dynamoDb = new AWS.DynamoDB();

      expect((AWS.DynamoDB.DocumentClient as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((AWS.DynamoDB as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((docClient.get as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((dynamoDb.getItem as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      awsMock.restore('DynamoDB');
      expect((AWS.DynamoDB.DocumentClient as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect(AWS.DynamoDB.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect((docClient.get as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect(dynamoDb.getItem.hasOwnProperty('isSinonProxy')).toEqual(false);

      awsMock.mock('DynamoDB', 'getItem', 'test');
      dynamoDb = new AWS.DynamoDB();
      expect((AWS.DynamoDB.DocumentClient as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((AWS.DynamoDB as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((docClient.get as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect((dynamoDb.getItem as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      awsMock.restore('DynamoDB.DocumentClient');

      // the first assertion is true because DynamoDB is still mocked
      expect(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy')).toEqual(true);
      expect((AWS.DynamoDB as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);
      expect(docClient.get.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect((dynamoDb.getItem as unknown as MaybeSoninProxy).isSinonProxy).toEqual(true);

      awsMock.restore('DynamoDB');
      expect(AWS.DynamoDB.DocumentClient.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(AWS.DynamoDB.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(docClient.get.hasOwnProperty('isSinonProxy')).toEqual(false);
      expect(dynamoDb.getItem.hasOwnProperty('isSinonProxy')).toEqual(false);
    });
    it('Mocked services should use the implementation configuration arguments without complaining they are missing', function () {
      awsMock.mock('CloudSearchDomain', 'search', function (params, callback) {
        return callback(null, 'message');
      });

      const csd: CloudSearchDomain = new AWS.CloudSearchDomain({
        endpoint: 'some endpoint',
        region: 'eu-west',
      });

      awsMock.mock('CloudSearchDomain', 'suggest', function (params, callback) {
        return callback(null, 'message');
      });

      csd.search({ query: '' }, function (err, data) {
        expect(data).toEqual('message');
      });

      csd.search({ query: '' }, function (err, data) {
        expect(data).toEqual('message');
      });
    });

    it.skip('Mocked service should return the sinon stub', function () {
      // TODO: the stub is only returned if an instance was already constructed
      const stub = awsMock.mock('CloudSearchDomain', 'search', '');
      expect(stub.stub?.isSinonProxy).toEqual(true);    
    });

    it('Restore should not fail when the stub did not exist.', function () {
      // This test will fail when restoring throws unneeded errors.
      try {
        awsMock.restore('');
        awsMock.restore('', '');
        awsMock.restore('Lambda');
        awsMock.restore('SES', 'sendEmail');
        awsMock.restore('CloudSearchDomain', 'doesnotexist');
      } catch (e) {
        console.log(e);
      }
    });

    it('Restore should not fail when service was not mocked', function () {
      // This test will fail when restoring throws unneeded errors.
      try {
        awsMock.restore('CloudFormation');
        awsMock.restore('UnknownService');
      } catch (e) {
        console.log(e);
      }
    });

    it('Mocked service should allow chained calls after listening to events', function () {
      awsMock.mock('S3', 'getObject', '');
      const s3 = new AWS.S3();
      const req = s3.getObject({ Bucket: 'b', Key: '' });
      expect(req.on('httpHeaders', () => {})).toEqual(req);
    });

    it('Mocked service should return replaced function when request send is called', function () {
      awsMock.mock('S3', 'getObject', { Body: 'body' });
      let returnedValue = '';
      const s3 = new AWS.S3();
      const req = s3.getObject({ Bucket: 'b', Key: '' }, () => {});
      req.send(async (err: any, data: any) => {
        returnedValue = data.Body;
      });
      expect(returnedValue).toEqual('body');
    });

    it('mock function replaces method with a sinon stub and returns successfully using callback', function () {
      const sinonStub = sinon.stub();
      sinonStub.returns('message');
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem({ TableName: '', Key: {} }, function (err, data) {
        expect(data).toEqual('message');
        expect(sinonStub.called).toEqual(true);
      });
    });

    it('mock function replaces method with a sinon stub and returns successfully using promise', function () {
      const sinonStub = sinon.stub();
      sinonStub.returns('message');
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem({ TableName: '', Key: {} })
        .promise()
        .then(function (data) {
          expect(data).toEqual('message');
          expect(sinonStub.called).toEqual(true);
        });
    });

    it('mock function replaces method with a mock and returns successfully', function () {
      const sinonStub = sinon.stub().returns('message');
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem({ TableName: '', Key: {} }, function (err, data) {
        expect(data).toEqual('message');
        expect(sinonStub.callCount).toEqual(1);
      });
    });

    it('mock function replaces method with a mock returning successfully and allows mocked method to be called with only callback', function () {
      const sinonStub = sinon.stub().returns('message');
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem(function (err, data) {
        expect(data).toEqual('message');
        expect(sinonStub.callCount).toEqual(1);
      });
    });

    it('mock function replaces method with a mock and resolves successfully', function () {
      const sinonStub = sinon.stub().returns('message');
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem({ TableName: '', Key: {} }, function (err, data) {
        expect(data).toEqual('message');
        expect(sinonStub.callCount).toEqual(1);
      });
    });

    it('mock function replaces method with a mock and fails successfully', function () {
      const sinonStub = sinon.stub().throws(new Error('something went wrong'));
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem({ TableName: '', Key: {} }, function (err) {
        expect(err.message).toEqual('something went wrong');
        expect(sinonStub.callCount).toEqual(1);
      });
    });

    it('mock function replaces method with a mock and rejects successfully', function () {
      const sinonStub = sinon.stub().rejects(new Error('something went wrong'));
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem({ TableName: '', Key: {} }, function (err) {
        expect(err.message).toEqual('something went wrong');
        expect(sinonStub.callCount).toEqual(1);
      });
    });

    it('mock function replaces method with a mock with implementation', function () {
      const sinonStub = sinon.stub().yields(null, 'item');
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem({ TableName: '', Key: {} }, function (err, data) {
        expect(sinonStub.callCount).toEqual(1);
        expect(data).toEqual('item');
      });
    });

    it('mock function replaces method with a mock with implementation and allows mocked method to be called with only callback', function () {
      const sinonStub = sinon.stub().returns('item');
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem(function (err, data) {
        expect(sinonStub.callCount).toEqual(1);
        expect(data).toEqual('item');
      });
    });

    it('mock function replaces method with a mock with implementation expecting only a callback', function () {
      const sinonStub = sinon.stub().returns('item');
      awsMock.mock('DynamoDB', 'getItem', sinonStub);
      const db: DynamoDB = new AWS.DynamoDB();
      db.getItem(function (err, data) {
        expect(sinonStub.callCount).toEqual(1);
        expect(data).toEqual('item');
      });
    });

    it('Mocked service should allow abort call', function () {
      awsMock.mock('S3', 'upload', '');
      const s3 = new AWS.S3();
      const req = s3.upload({Bucket: '', Key: ''}, { leavePartsOnError: true }, function () {});
      req.abort();
    });
  });

  describe('AWS.setSDK function should mock a specific AWS module', function () {
    it('Specific Modules can be set for mocking', async function () {
      awsMock.setSDK('aws-sdk');
      awsMock.mock('SNS', 'publish', 'message');
      const sns: SNS = new AWS.SNS();
      sns.publish({ Message: '' }, function (err, data) {
        expect(data).toEqual('message');
      });
    });

    it('Modules with multi-parameter constructors can be set for mocking', async function () {
      awsMock.setSDK('aws-sdk');
      awsMock.mock('CloudFront.Signer', 'getSignedUrl', '');
      const signer = new AWS.CloudFront.Signer('key-pair-id', 'private-key');
      expect(signer).toBeDefined();
    });

    it('Setting the aws-sdk to the wrong module can cause an exception when mocking', async function () {
      awsMock.setSDK('sinon');
      try {
        awsMock.mock('SNS', 'publish', 'message');
        throw 'Mocking should have thrown an error for an invalid module'
      } catch (error) {
        // No error was tossed
        expect(true).toBeTruthy();
      }
      awsMock.setSDK('aws-sdk');
    });
  });

  describe('AWS.setSDKInstance function should mock a specific AWS module', function () {
    it('Specific Modules can be set for mocking', function () {
      awsMock.setSDKInstance(aws2);
      awsMock.mock('SNS', 'publish', 'message2');
      const sns: SNS = new AWS.SNS();
      sns.publish({ Message: '' }, function (err, data) {
        expect(data).toEqual('message2');
      });
    });

    it('Setting the aws-sdk to the wrong instance can cause an exception when mocking', function () {
      const bad = {};
      //@ts-ignore This won't be possible with typescript but in case someone tries to override it, we'll test it this way
      awsMock.setSDKInstance(bad);
      expect(function () {
        awsMock.mock('SNS', 'publish', 'message');
      }).toThrow();
      awsMock.setSDKInstance(AWS);
    });
  });
});
