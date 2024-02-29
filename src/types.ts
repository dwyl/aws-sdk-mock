import { type Request, type AWSError } from 'aws-sdk/lib/core.js';
import AWS = require('aws-sdk/clients/all');
import {type SinonStub } from 'sinon';

/*
* Don't make this a `d.ts` file - see https://www.youtube.com/watch?v=zu-EgnbmcLY&ab_channel=MattPocock
* or https://github.com/microsoft/TypeScript/issues/52593#issuecomment-1419505081
*/

// Utility types
export type ValueType<T, K extends keyof T> = T[K];

// AWS clients
export type ClientName = keyof typeof AWS;
export type Client<C extends ClientName> = InstanceType<(typeof AWS)[C]>;

// Extract method utility type to get method from client
export type ExtractMethod<T extends {}> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never };

// AWS Method types
export type MethodName<C extends ClientName> = keyof ExtractMethod<Client<C>>;
export type Method<C extends ClientName, M extends MethodName<C>> = ExtractMethod<Client<C>>[M];

// AWS request type
export type AWSRequest<C extends ClientName, M extends MethodName<C>> = Method<C, M> extends AWSMethod<infer P, any> ? P : never;

// AWS callback type
export type AWSCallback<C extends ClientName, M extends MethodName<C>> = Method<C, M> extends AWSMethod<any, infer D>
  ? {
      (err: undefined, data: D): void;
      (err: AWSError, data?: undefined): void;
    }
  : any;

// Replace function in mock/remock/restore functions. Can be a function, string or object
export type ReplaceFn<C extends ClientName, M extends MethodName<C>> =
  | ((params: AWSRequest<C, M>, options: any, callback: AWSCallback<C, M>) => any)
  | string
  | object;

// Interface from AWS method type
export type Callback<D> = (err: AWSError | undefined, data: D) => void;
export interface AWSMethod<P, D> {
  (params: P, callback?: Callback<D>): Request<D, AWSError>;
  (callback?: Callback<D>): Request<D, AWSError>;
}

// Stub type that can possibly be used while stubbing the given replace function
export type MaybeSoninProxy = {
  _isMockFunction: boolean;
  isSinonProxy: boolean;
};

export type MethodMock = {
  [key: string]: Replace<ClientName, MethodName<ClientName>>;
};

export type Replace<C extends ClientName, M extends MethodName<C>> = {
  replace: ReplaceFn<C, M>;
  stub?: SinonStub<any, any> & Partial<MaybeSoninProxy>;
};

// AWS service object type
export interface Service {
  Constructor: new (...args: any[]) => any;
  methodMocks: MethodMock;
  invoked: boolean;
  clients?: Client<ClientName>[];
  stub?: SinonStub<any, any>;
}

// AWS client type with extended options (to cover edge cases)
export type ExtendedClient = Client<ClientName> & {
  options: {
    attrValue: ClientName;
    paramValidation: boolean;
  };
  api: {
    operations: any;
  };
};

// All possible services from `aws-sdk`
export type SERVICES<T extends string> = {
  [key in T]: Service;
};

// Nested clients and nested methods types

/**
 * You can find in the commented block below the first implementation of nested types.
 * They *don't work* because it's impossible. The `aws-sdk` library exports clients and each "method" is a type, not a value.
 * Therefore, it's impossible to get these as string literals.
 * See our question on Stack Overflow answered in https://stackoverflow.com/questions/77413867/how-to-create-a-type-that-yields-a-dot-notation-of-nested-class-properties-as-st.
 *
 * Because we still want the Typescript compiler to show the original clients as suggestions
 * when using an IDE, we're using `OtherString` as a branded primitive type.
 * It allows us the compiler to not reduce the `ClientName` string literals to `string`
 * but still accept any string, all the while suggesting the string literals from `ClientName`.
 *
 * For more detailed explanation on this, check https://stackoverflow.com/questions/67757457/make-typescript-show-type-hint-for-string-literal-when-union-with-string-primiti.
 * For a simple explanation, check https://github.com/microsoft/TypeScript/issues/29729#issuecomment-567871939.
 */

type OtherString = string & {};
export type NestedClientName = ClientName | OtherString;
export type NestedMethodName = OtherString;

/**
 * This is the first implementation attempt.
 *
 * The SDK defines a class for each service as well as a namespace with the same name.
 * Nested clients, e.g. DynamoDB.DocumentClient, are defined on the namespace, not the class.
 * That is why we need to fetch these separately as defined below in the NestedClientName<C> type
 *
 * The NestedClientFullName type supports validating strings representing a nested clients name in dot notation
 *
 * We add the ts-ignore comments to avoid the type system to trip over the many possible values for NestedClientName<C>
 */
//export type NestedClientName<C extends ClientName> = keyof typeof AWS[C];
//// @ts-ignore
//export type NestedClientFullName<C extends ClientName, NC extends NestedClientName<C>> = `${C}.${NC}`;
//// @ts-ignore
//export type NestedClient<C extends ClientName, NC extends NestedClientName<C>> = InstanceType<(typeof AWS)[C][NC]>;
//// @ts-ignore
//export type NestedMethodName<C extends ClientName, NC extends NestedClientName<C>> = keyof ExtractMethod<NestedClient<C, NC>>;
