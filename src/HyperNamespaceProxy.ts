import { DurableObjectNamespace, NewUniqueIdOptions } from '@miniflare/durable-objects';

interface HyperDurableStub<T> extends DurableObjectStub {}

export class HyperNamespaceProxy {
  get?(id: DurableObjectId): DurableObjectStub;
  newUniqueId?(_options?: NewUniqueIdOptions): DurableObjectId;
  idFromName?(name: string): DurableObjectId;
  idFromString?(hexId: string): DurableObjectId;

  constructor(namespace: DurableObjectNamespace) {
    const handler = {
      get: (target: any, key: string, receiver: any) => {

      }
    };

    return new Proxy(namespace, handler);
  }
}

export const proxyHyperDurables = () => {

}
