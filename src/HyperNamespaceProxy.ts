export class HyperNamespaceProxy<T> implements DurableObjectNamespace {
  namespace: DurableObjectNamespace;
  ref: T;

  newUniqueId: (_options?: DurableObjectNamespaceNewUniqueIdOptions) => DurableObjectId;
  idFromName: (name: string) => DurableObjectId;
  idFromString: (hexId: string) => DurableObjectId;

  constructor(
    namespace: DurableObjectNamespace,
    ref: new (state: DurableObjectState, env: unknown) => T
  ) {
    this.namespace = namespace;
    // Create a reference of the DO to check for methods / properties
    // @ts-ignore
    this.ref = new ref({}, {});

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
    // All of our props & methods return Promises that resolve to Responses, since everything
    // uses the fetch interface.
    type PromisedStub = {
      [Prop in keyof T]?:
        T[Prop] extends Function ?
        () => Promise<Response> :
        Promise<Response>;
    };
    type HyperStub = DurableObjectStub & PromisedStub;

    const stub = this.namespace.get(id);
    const hyperStub: HyperStub = Object.assign<DurableObjectStub, PromisedStub>(stub, {});

    function createHyperRequest(action: string, key: string, payload?: object) {
      return new Request(`https://hd.io/${action}/${key}`, {
        body: payload ? JSON.stringify(payload) : null,
        method: payload ? 'POST' : 'GET',
        headers: {
          'Content-Type': payload ? 'application/json' : null,
        },
      });
    }

    async function sendHyperRequest(durable: DurableObjectStub, request: Request) {
      const promise = durable.fetch(request);
      return promise.then(res => res.json());
    }

    const handler = {
      get: (_target: object, key: string) => {
        // Short circuit for fetch to maintain manual access
        if (key === 'fetch') return hyperStub.fetch.bind(hyperStub);

        if (typeof this.ref[key] === 'function') {
          // Anonymous function to pass args
          return function (...args: any[]) {
            const request = createHyperRequest('call', key, { args });
            return sendHyperRequest(hyperStub, request);
          }
        }

        // Properties
        const request = createHyperRequest('get', key);
        return sendHyperRequest(hyperStub, request);
      },
      set: (_target: object, key: string, value: any): any => {
        const request = createHyperRequest('set', key, { value });
        return sendHyperRequest(hyperStub, request);
      }
    }

    return new Proxy<HyperStub>(hyperStub, handler);
  }
}

export const proxyHyperDurables = () => {
  return true;
}
