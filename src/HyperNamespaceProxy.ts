export class HyperNamespaceProxy {
  get?(id: DurableObjectId): DurableObjectStub;
  newUniqueId?(_options?: DurableObjectNamespaceNewUniqueIdOptions): DurableObjectId;
  idFromName?(name: string): DurableObjectId;
  idFromString?(hexId: string): DurableObjectId;

  constructor(namespace: DurableObjectNamespace) {
    const handler = {
      get: (target: object, key: string, receiver: any) => {
        // If prop is a function, bind `this`
        return typeof target[key] === 'function'
          ? target[key].bind(target)
          : Reflect.get(target, key, receiver);
      }
    };

    return new Proxy(namespace, handler);
  }
}

export const proxyHyperDurables = () => {
  return true;
}
