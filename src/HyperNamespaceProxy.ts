export class HyperNamespaceProxy<T> implements DurableObjectNamespace {
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

        // If prop is another function, bind `this` to the original namespace
        return typeof target[key] === 'function'
          ? target[key].bind(namespace)
          : Reflect.get(target, key, receiver);
      }
    };

    return new Proxy(this, handler);
  }

  get(id: DurableObjectId) {
    type PromisedStub = {
      [Prop in keyof T]?:
        Prop extends (...args: any[]) => any ?
        () => Promise<Response> :
        Promise<Response>;
    };

    type HyperStub = DurableObjectStub & PromisedStub;

    const stub = this.namespace.get(id);
    const hyperStub: HyperStub = Object.assign<DurableObjectStub, PromisedStub>(stub, {});

    const handler = {
      get: (target: object, key: string) => {
        // Short circuit for fetch to maintain manual access
        if (key === 'fetch') return hyperStub.fetch.bind(hyperStub);

        // Anonymous function to pass args
        if (typeof target[key] === 'function') {
          return function (...args: any[]) {
            const request = this.createHyperRequest('call', key, { args });
            return this.sendHyperRequest(hyperStub, request);
          }
        }

        // Properties
        const request = this.createHyperRequest('get', key);
        return this.sendHyperRequest(hyperStub, request);
      },
      set: (_target: object, key: string, value: any): any => {
        const request = this.createHyperRequest('set', key, { value });
        return this.sendHyperRequest(hyperStub, request);
      }
    }

    return new Proxy<HyperStub>(hyperStub, handler);
  }

  private createHyperRequest(action: string, key: string, payload?: object) {
    return new Request(`https://hd.io/${action}/${key}`, {
      body: payload ? JSON.stringify(payload) : null,
      method: payload ? 'POST' : 'GET',
      headers: {
        'Content-Type': payload ? 'application/json' : null,
      },
    });
  }

  private async sendHyperRequest(durable: DurableObjectStub, request: Request) {
    const promise = durable.fetch(request);

    return promise.then(res => res.json());
  }
}

export const proxyHyperDurables = () => {
  return true;
}
