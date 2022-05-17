export class HyperNamespaceProxy {
  namespace: DurableObjectNamespace;

  newUniqueId: (_options?: DurableObjectNamespaceNewUniqueIdOptions) => DurableObjectId;
  idFromName: (name: string) => DurableObjectId;
  idFromString: (hexId: string) => DurableObjectId;

  constructor(namespace: DurableObjectNamespace) {
    this.namespace = namespace;
    this.newUniqueId = namespace.newUniqueId;
    this.idFromName = namespace.idFromName;
    this.idFromString = namespace.idFromString;


    const handler = {
      get: (target: any, key: string, receiver: any) => {
        // Return bound stub getter
        if (key === 'get') return this.get.bind(this);

        // If prop is a function, bind `this`
        return typeof target[key] === 'function'
          ? target[key].bind(namespace)
          : Reflect.get(target, key, receiver);
      }
    };

    return new Proxy(this, handler);
  }

  get(id: DurableObjectId) {
    const stub = this.namespace.get(id);

    const handler = {
      get: (target: object, key: string) => {
        // Short circuit for fetch to maintain manual access
        if (key === 'fetch') return stub.fetch.bind(stub);

        // Anonymous function to pass args
        if (typeof target[key] === 'function') {
          return function (...args: any[]) {
            const request = this.createHyperRequest('call', key, { args });
            return this.sendHyperRequest(stub, request);
          }
        }

        // Props
        const request = this.createHyperRequest('get', key);
        return this.sendHyperRequest(stub, request);
      },
      set: (_target: object, key: string, value: any): any => {
        const request = this.createHyperRequest('set', key, { value });
        return this.sendHyperRequest(stub, request);
      }
    }

    return new Proxy<DurableObjectStub>(stub, handler);
  }

  createHyperRequest(action: string, key: string, payload?: object) {
    return new Request(`https://hd.io/${action}/${key}`, {
      body: payload ? JSON.stringify(payload) : null,
      method: payload ? 'POST' : 'GET',
      headers: {
        'Content-Type': payload ? 'application/json' : null,
      },
    });
  }

  sendHyperRequest(durable: DurableObjectStub, request: Request) {
    const promise = durable.fetch(request);

    return promise.then(res => res.json());
  }
}

export const proxyHyperDurables = () => {
  return true;
}
