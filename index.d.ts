import AWSClientAll from "aws-sdk/clients/all";
import AWS from "aws-sdk";

export function mock<
  T extends keyof typeof AWSClientAll,
  K extends InstanceType<typeof AWSClientAll[T]> = InstanceType<
    typeof AWSClientAll[T]
  >,
  F extends keyof K = keyof K
>(service: T, method: F, replace: string | ((...args: any[]) => void)): void;

export function remock<
  T extends keyof typeof AWSClientAll,
  K extends InstanceType<typeof AWSClientAll[T]> = InstanceType<
    typeof AWSClientAll[T]
  >,
  F extends keyof K = keyof K
>(service: T, method: F, replace: string | ((...args: any[]) => void)): void;

export function restore<
  T extends keyof typeof AWSClientAll,
  K extends keyof InstanceType<typeof AWSClientAll[T]> = keyof InstanceType<
    typeof AWSClientAll[T]
  >
>(service?: T, method?: K): void;

export function setSDK(path: string): void;
export function setSDKInstance(instance: typeof AWS): void;
