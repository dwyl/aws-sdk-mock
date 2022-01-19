import * as AWS from 'aws-sdk';
import { AWSError } from 'aws-sdk';
import { ListObjectsV2Request } from 'aws-sdk/clients/s3';
import { expectError, expectType } from 'tsd';
import { mock, remock, restore, setSDK, setSDKInstance } from '../index';

const awsError: AWSError = {
    name: 'AWSError',
    message: 'message',
    code: 'code',
    time: new Date(),
};

expectType<void>(mock('S3', 'listObjectsV2', (params, callback) => {
    expectType<ListObjectsV2Request>(params);

    const output: AWS.S3.ListObjectsV2Output = {
        Name: params.Bucket,
        MaxKeys: params.MaxKeys,
        Delimiter: params.Delimiter,
        Prefix: params.Prefix,
        KeyCount: 1,
        IsTruncated: false,
        ContinuationToken: params.ContinuationToken,
        Contents: [
            {
                LastModified: new Date(),
                ETag: '"668d791b0c7d6a7f0f86c269888b4546"',
                StorageClass: 'STANDARD',
                Key: 'aws-sdk-mock/index.js',
                Size: 8524,
            },
        ]
    };
    expectType<void>(callback(undefined, output));

    expectType<void>(callback(undefined, {}));

    expectError(callback(null, output));

    expectError(callback(undefined));

    expectType<void>(callback(awsError));

    expectError(callback(awsError, output));
}));

expectError(mock('S3', 'describeObjects', (params, callback) => {
    expectType<never>(params);
    expectType<never>(callback);
}));

expectType<void>(mock('DynamoDB', 'getItem', 'anything could happen'));

expectError(mock('StaticDB', 'getItem', "it couldn't"));

expectType<void>(remock('EC2', 'stopInstances', (params, callback) => {
    // $ExpectType string[]
    const instanceIds = params.InstanceIds;
    expectType<string[]>(instanceIds);

    const output: AWS.EC2.StopInstancesResult = {
        StoppingInstances: instanceIds.map(id => ({
            InstanceId: id,
            PreviousState: { Name: 'running' },
            CurrentState: { Name: 'stopping' },
        })),
    };
    expectType<void>(callback(undefined, output));

    expectType<void>(callback(undefined, {}));

    expectError(callback(null, output));

    expectError(callback(undefined));

    expectType<void>(callback(awsError));

    expectError(callback(awsError, output));
}));

expectType<void>(remock('Snowball', 'makeRequest', undefined));
expectError(remock('Snowball', 'throwRequest', undefined));

expectType<void>(restore('Pricing', 'getProducts'));

expectError(restore('Pricing', 'borrowMoney'));

expectType<void>(restore('KMS'));

expectError(restore('Skynet'));

expectError(restore(42));

expectType<void>(restore());

expectError(restore(null));

expectType<void>(setSDK('aws-sdk'));

expectType<void>(setSDKInstance(AWS));

expectError(setSDKInstance(import('aws-sdk')));

async function foo() {
    expectType<void>(setSDKInstance(await import('aws-sdk')));
}

expectError(setSDKInstance(AWS.S3));

import allClients = require('aws-sdk/clients/all');

expectError(setSDKInstance(allClients));
