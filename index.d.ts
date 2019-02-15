declare module 'aws-sdk-mock' {
  function mock(service: string, method: string, replace: any): void;

  function mock(
    service: string,
    method: string,
    replace: (params: any, callback: (err: any, data: any) => void) => void
  ): void;

  function remock(service: string, method: string, replace: any): void;
  function remock(
    service: string,
    method: string,
    replace: (params: any, callback: (err: any, data: any) => void) => void
  ): void;

  function restore(service?: string, method?: string): void;

  function setSDK(path: string): void;
  function setSDKInstance(instance: object): void;
}
