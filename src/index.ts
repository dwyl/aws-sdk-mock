/// <reference path="types.ts"" />
'use strict';

/**
 * Helpers to mock the AWS SDK Services using sinon.js under the hood
 * Mocking is done in two steps:
 * - mock of the constructor for the service on AWS.
 * - mock of the method on the service.
 **/

import type { SinonExpectation, SinonSpy, SinonStubbedInstance } from 'sinon';
import sinon from 'sinon';
import traverse from 'neotraverse/legacy';
import { Readable } from 'stream';

import AWS_SDK from 'aws-sdk';

import {
  type ReplaceFn,
  type ClientName,
  type MethodName,
  type NestedClientName,
  type NestedMethodName,
  type Client,
  type AWSCallback,
  type AWSRequest,
  type SERVICES,
  type Service,
  type ExtendedClient,
  type MaybeSoninProxy,
  type Replace,
  type ValueType,
  type MethodMock,
} from './types.js';

// TYPES -----------------------------------
// AWS type to be exported
type AWS_MOCK = {
  mock: typeof mock;
  remock: typeof remock;
  restore: typeof restore;
  setSDK: typeof setSDK;
  setSDKInstance: typeof setSDKInstance;
  Promise: Awaited<Promise<any>>;
};

// PACKAGE ---------------------------------
// Real AWS instance from 'aws-sdk'
let _AWS: typeof AWS_SDK = AWS_SDK;

// AWS that is exported to the client
const AWS: AWS_MOCK = {
  Promise: global.Promise,
  mock: mock,
  remock: remock,
  restore: restore,
  setSDK: setSDK,
  setSDKInstance: setSDKInstance,
};
const services: Partial<SERVICES<ClientName>> = {};

/**
 * Explicitly sets the `aws-sdk` to be mocked.
 * @param path path for the `aws-sdk`.
 */
async function setSDK(path: string): Promise<void> {
  _AWS = require(path);
}

/**
 * Explicitly sets the `aws-sdk` instance to be used.
 * @param sdk the `aws-sdk` instance.
 */
function setSDKInstance(sdk: typeof AWS_SDK): void {
  _AWS = sdk;
}

/**
 * Stubs the service and registers the method that needs to be mocked.
 *
 * @param service AWS service to mock (e.g. DynamoDB).
 * @param method method on AWS service to mock (e.g. `putItem` for DynamoDB).
 * @param replace string or function to replace the method.
 */
function mock<C extends ClientName>(
  service: NestedClientName,
  method: NestedMethodName,
  replace: ReplaceFn<C, MethodName<ClientName>>
): Replace<ClientName, MethodName<ClientName>>;
function mock<C extends ClientName, M extends MethodName<C> & string>(
  service: C,
  method: M,
  replace: ReplaceFn<C, MethodName<ClientName>>
): Replace<ClientName, MethodName<ClientName>> {
  // If the service does not exist yet, we need to create and stub it.
  if (!services[service]) {
    const service_to_add: Service = {
      // Save the real constructor so we can invoke it later on.
      // Uses traverse for easy access to nested services (dot-separated)
      Constructor: traverse(_AWS).get(service.split('.')),
      methodMocks: {},
      invoked: false,
    };

    services[service] = service_to_add;
    mockService(service);
  }

  const serviceObj = services[service] as Service; // we know it's `Service` because `services[service]` is defined here
  const methodName = method as MethodName<ClientName>;

  // Register the method to be mocked out.
  if (!serviceObj.methodMocks[methodName]) {
    // Adding passed mock method
    if (serviceObj !== undefined) serviceObj.methodMocks[methodName] = { replace: replace };

    // If the constructor was already invoked, we need to mock the method here.
    if (serviceObj.invoked) {
      serviceObj.clients?.forEach((client: Client<ClientName>) => {
        mockServiceMethod(service, client, methodName, replace);
      });
    }
  }

  // we know it's defined because we've defined `serviceObj.methodMocks[methodName]` above.
  const methodMockObj = serviceObj.methodMocks[methodName] as ValueType<MethodMock, keyof MethodMock>;

  return methodMockObj;
}

/**
 * Stubs the service and registers the method that needs to be re-mocked.
 *
 * @param service AWS service to mock (e.g. DynamoDB).
 * @param method method on AWS service to mock (e.g. `putItem` for DynamoDB).
 * @param replace string or function to replace the method.
 */
function remock<C extends ClientName>(service: NestedClientName, method: NestedMethodName, replace: ReplaceFn<C, MethodName<ClientName>>): void;
function remock<C extends ClientName, M extends MethodName<C> & string>(
  service: C,
  method: M,
  replace: ReplaceFn<ClientName, MethodName<ClientName>>
) {
  // If the method is inside the service, we restore the method
  if (services[service]?.methodMocks[method]) {
    restoreMethod(service, method);

    const service_obj = services[service];
    if (service_obj !== undefined) {
      service_obj.methodMocks[method] = {
        replace: replace,
      };
    }
  }

  const methodName = method as MethodName<ClientName>;
  // We check if the service was invoked or not. If it was, we mock the service method with the `replace` function
  if (services[service]?.invoked) {
    services[service]?.clients?.forEach((client: Client<ClientName>) => {
      mockServiceMethod(service, client, methodName, replace);
    });
  }

  return services[service]?.methodMocks[method];
}

/**
 * Stub the constructor for the service on AWS.
 * For example, calls of the new `AWS.SNS()` are replaced.
 *
 * @param service AWS service to mock (e.g. DynamoDB).
 * @returns the stubbed service.
 */
function mockService(service: ClientName) {
  const nestedServices: string[] = service.split('.');

  //TODO check for undefined behaviour. If "" is passed, it will be undefined
  const method = nestedServices.pop() as string;
  // Method type guard
  //if (!method) return;

  const object = traverse(_AWS).get(nestedServices);

  const service_obj = services[service];

  if (service_obj) {
    const serviceStub = sinon.stub(object, method).callsFake(function (...args) {
      service_obj.invoked = true;

      /**
       * Create an instance of the service by calling the real constructor
       * we stored before. E.g. const client = new AWS.SNS()
       * This is necessary in order to mock methods on the service.
       */
      const client = new service_obj.Constructor(...args);
      service_obj.clients = service_obj.clients || [];
      service_obj.clients.push(client);

      // Once this has been triggered we can mock out all the registered methods.
      for (const key in service_obj.methodMocks) {
        const methodKey = key as MethodName<ClientName>;
        const objectMethodMock = service_obj.methodMocks[key];
        if (objectMethodMock) {
          mockServiceMethod(service, client, methodKey, objectMethodMock.replace);
        }
      }
      return client;
    });
    service_obj.stub = serviceStub;
  }
}

/**
 * Wraps a sinon stub or jest mock function as a fully functional replacement function.
 *
 * **Note**:
 *
 * If you want to help us better define the `replace` function (without having to use any), please open a PR
 * (especially if you're a TS wizard 🧙‍♂️).
 * We're not entirely sure if `SinonStubbedInstance<any>` is correct,
 * but we're adding this instead of `replace: any` to maintain specificity.
 *
 * @param replace function to wrap the stub with.
 * @returns the stub wrapped with the given function.
 */
function wrapTestStubReplaceFn(replace: ReplaceFn<ClientName, MethodName<ClientName>> | MaybeSoninProxy | SinonStubbedInstance<any>) {
  if (typeof replace !== 'function' || !(replace._isMockFunction || replace.isSinonProxy)) {
    return replace;
  }

  return (params: AWSRequest<ClientName, MethodName<ClientName>>, callback: AWSCallback<ClientName, MethodName<ClientName>> | undefined) => {
    // If only one argument is provided, it is the callback
    let cb: typeof params | AWSCallback<ClientName, MethodName<ClientName>>;
    if (callback === undefined || !callback) {
      cb = params;
    }

    // If not, the callback is the passed cb
    else {
      cb = callback;
    }

    // Spy on the users callback so we can later on determine if it has been called in their replace
    const cbSpy = sinon.spy(cb);
    try {
      // The replace function can also be a `functionStub`.
      // Call the users replace, check how many parameters it expects to determine if we should pass in callback only, or also parameters
      const result = replace.length === 1 ? replace(cbSpy) : replace(params, cbSpy);
      // If the users replace already called the callback, there's no more need for us do it.
      if (cbSpy.called) {
        return;
      }
      if (typeof result.then === 'function') {
        result.then(
          /* istanbul ignore next */
          (val: any) => cb(undefined, val),
          (err: any) => {
            return cb(err);
          }
        );
      } else {
        cb(undefined, result);
      }
    } catch (err) {
      cb(err);
    }
  };
}

/**
 *  Stubs the method on a service.
 *
 *  All AWS service methods take two arguments:
 *  - `params`: an object.
 *  - `callback`: of the form 'function(err, data) {}'.
 *
 * @param service service in which the method to stub resides in.
 * @param client AWS client.
 * @param method method to stub.
 * @param replace function to stub with.
 * @returns the stubbed service method.
 */
function mockServiceMethod(
  service: ClientName,
  client: Client<ClientName>,
  method: MethodName<ClientName>,
  replace: ReplaceFn<ClientName, MethodName<ClientName>>
) {
  replace = wrapTestStubReplaceFn(replace);

  //TODO check for undefined behaviour. If "" is passed, it will be undefined
  const service_obj = services[service] as Service;
  // Service type guard
  //if (!service_obj) return;

  //TODO check for undefined behaviour. If "" is passed, it will be undefined
  const serviceMethodMock = service_obj.methodMocks[method] as Replace<ClientName, MethodName<ClientName>>;
  // Service method mock type guard
  //if (!serviceMethodMock) return;

  serviceMethodMock.stub = sinon.stub(client, method).callsFake(function () {
    const args = Array.prototype.slice.call(arguments);

    let userArgs: string | Function[];
    let userCallback: Function;

    if (typeof args[(args.length || 1) - 1] === 'function') {
      userArgs = args.slice(0, -1);
      userCallback = args[(args.length || 1) - 1];
    } else {
      userArgs = args;
    }

    const havePromises = typeof AWS.Promise === 'function';

    let promise: typeof AWS.Promise;
    let resolve: (value: any) => any;
    let reject: (value: any) => any;
    let storedResult: Awaited<Promise<any>>;

    const tryResolveFromStored = function () {
      if (storedResult && promise) {
        if (typeof storedResult.then === 'function') {
          storedResult.then(resolve, reject);
        } else if (storedResult.reject) {
          reject(storedResult.reject);
        } else {
          resolve(storedResult.resolve);
        }
      }
    };

    const callback = function (err: unknown, data: unknown) {
      if (!storedResult) {
        if (err) {
          storedResult = { reject: err };
        } else {
          storedResult = { resolve: data };
        }
      }
      if (userCallback) {
        userCallback(err, data);
      }
      tryResolveFromStored();
    };

    const request = {
      promise: havePromises
        ? function () {
            if (!promise) {
              promise = new AWS.Promise(function (resolve_: any, reject_: any) {
                resolve = resolve_;
                reject = reject_;
              });
            }
            tryResolveFromStored();
            return promise;
          }
        /* istanbul ignore next */ : undefined,
      createReadStream: function () {
        if (storedResult instanceof Readable) {
          return storedResult;
        }
        if (replace instanceof Readable) {
          return replace;
        } else {
          const stream = new Readable();
          stream._read = function () {
            if (typeof replace === 'string' || Buffer.isBuffer(replace)) {
              this.push(replace);
            }
            this.push(null);
          };
          return stream;
        }
      },
      on: function (eventName: string, callback: Function) {
        return this;
      },
      send: function (callback: Function) {
        callback(storedResult.reject, storedResult.resolve);
      },
      abort: function () {},
    };

    // different locations for the paramValidation property
    const _client = client as ExtendedClient;
    const config = _client.config || _client.options || _AWS.config;
    if (config.paramValidation) {
      try {
        // different strategies to find method, depending on whether the service is nested/unnested
        const inputRules = ((_client.api && _client.api.operations[method]) || _client[method] || {}).input;
        if (inputRules) {
          const params = userArgs[(userArgs.length || 1) - 1];
          // @ts-expect-error
          new _AWS.ParamValidator((_client.config || _AWS.config).paramValidation).validate(inputRules, params);
        }
      } catch (e) {
        callback(e, null);
        return request;
      }
    }

    // If the value of 'replace' is a function we call it with the arguments.
    if (replace instanceof Function) {
      const concatUserArgs = userArgs.concat([callback]) as [params: never, options: any, callback: any];
      const result = replace.apply(replace, concatUserArgs);
      if (
        storedResult === undefined &&
        result != null &&
        ((typeof result === 'object' && result.then instanceof Function) || result instanceof Readable)
      ) {
        storedResult = result;
      }
    }
    // Else we call the callback with the value of 'replace'.
    else {
      callback(null, replace);
    }
    return request;
  });
}

/**
 * Restores the mocks for just one method on a service, the entire service, or all mocks.
 *
 * When no parameters are passed, everything will be reset.
 * When only the service is passed, that specific service will be reset.
 * When a service and method are passed, only that method will be reset.
 *
 * @param service service to be restored.
 * @param method method of the service to be restored.
 */
function restore<C extends ClientName>(service?: NestedClientName, method?: NestedMethodName): void;
function restore<C extends ClientName>(service?: C, method?: MethodName<C>) {
  if (!service) {
    restoreAllServices();
  } else {
    if (method) {
      restoreMethod(service, method);
    } else {
      restoreService(service);
    }
  }
}

/**
 * Restores all mocked service and their corresponding methods.
 */
function restoreAllServices() {
  for (let serviceKey in services) {
    const service = serviceKey as ClientName;
    restoreService(service);
  }
}

/**
 * Restores a single mocked service and its corresponding methods.
 * @param service service to be restored.
 */
function restoreService(service: ClientName) {
  if (services[service]) {
    restoreAllMethods(service);

    const serviceObj = services[service];
    if (serviceObj) {
      const stubFun = services[service]?.stub as SinonExpectation;
      if (stubFun) {
        stubFun.restore();
      }
    }

    delete services[service];
  } else {
    console.log('Service ' + service + ' was never instantiated yet you try to restore it.');
  }
}

/**
 * Restores all mocked methods on a service.
 * @param service service with the methods to be restored.
 */
function restoreAllMethods(service: ClientName) {
  for (const method in services[service]?.methodMocks) {
    const methodName = method as MethodName<ClientName>;
    restoreMethod(service, methodName);
  }
}

/**
 * Restores a single mocked method on a service.
 * @param service service of the method to be restored.
 * @param method method to be restored.
 * @returns the restored method.
 */
function restoreMethod<C extends ClientName, M extends MethodName<C>>(service: C, method: M) {
  const methodName = method as string;

  const serviceObj = services[service];

  // Service type guard
  if (!serviceObj) {
    console.log('Method ' + service + ' was never instantiated yet you try to restore it.');
    return;
  }

  // restore this method on all clients
  const serviceClients = services[service]?.clients;
  if (serviceClients) {
    // Iterate over each client and get the mocked method and restore it
    serviceClients.forEach((client: Client<ClientName>) => {
      const mockedClientMethod = client[methodName as keyof typeof client] as SinonSpy;
      if (mockedClientMethod && typeof mockedClientMethod.restore === 'function') {
        mockedClientMethod.restore();
      }
    });
  }
  delete services[service]?.methodMocks[methodName];
}

(function () {
  const setPromisesDependency = _AWS.config.setPromisesDependency;
  /* only to support for older versions of aws-sdk */
  if (typeof setPromisesDependency === 'function') {
    AWS.Promise = global.Promise;
    _AWS.config.setPromisesDependency = function (p) {
      AWS.Promise = p;
      return setPromisesDependency(p);
    };
  }
})();

export = AWS;
