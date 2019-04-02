import AWS = require('aws-sdk');
import { mock, remock, restore, setSDK, setSDKInstance } from 'aws-sdk-mock';

// $ExpectType void
mock('S3', 'listObjectsV2', (params, callback) => {
    params;  // $ExpectType ListObjectsV2Request

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
    // $ExpectType void
    callback(undefined, output);

    // $ExpectType void
    callback(undefined, {});

    // $ExpectError
    callback(null, output);

    // $ExpectError
    callback(undefined);

    // $ExpectType void
    callback(new AWS.AWSError());

    // $ExpectError
    callback(new AWS.AWSError(), output);
});

// $ExpectError
mock('S3', 'describeObjects', (params, callback) => {
    params;  // $ExpectType never
    callback;  // $ExpectType never
});

// $ExpectType void
mock('DynamoDB', 'getItem', 'anything could happen');

// $ExpectError
mock('StaticDB', 'getItem', "it couldn't");

// $ExpectType void
remock('EC2', 'stopInstances', (params, callback) => {
    // $ExpectType string[]
    const instanceIds = params.InstanceIds;

    const output: AWS.EC2.StopInstancesResult = {
        StoppingInstances: instanceIds.map(id => ({
            InstanceId: id,
            PreviousState: { Name: 'running' },
            CurrentState: { Name: 'stopping' },
        })),
    };
    // $ExpectType void
    callback(undefined, output);

    // $ExpectType void
    callback(undefined, {});

    // $ExpectError
    callback(null, output);

    // $ExpectError
    callback(undefined);

    // $ExpectType void
    callback(new AWS.AWSError());

    // $ExpectError
    callback(new AWS.AWSError(), output);
});

// $ExpectType void
remock('Snowball', 'makeRequest', undefined);
// $ExpectError
remock('Snowball', 'throwRequest', undefined);

// $ExpectType void
restore('Pricing', 'getProducts');

// $ExpectError
restore('Pricing', 'borrowMoney');

// $ExpectType void
restore('KMS');

// $ExpectError
restore('Skynet');

// $ExpectError
restore(42);

// $ExpectType void
restore();

// $ExpectError
restore(null);

// $ExpectType void
setSDK('aws-sdk');

// $ExpectType void
setSDKInstance(AWS);

// $ExpectError
setSDKInstance(import('aws-sdk'));

async function foo() {
    // $ExpectType void
    setSDKInstance(await import('aws-sdk'));
}

// $ExpectError
setSDKInstance(AWS.S3);

import allClients = require('aws-sdk/clients/all');

// $ExpectError
setSDKInstance(allClients);
