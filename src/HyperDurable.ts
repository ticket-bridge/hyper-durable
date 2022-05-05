import { Router } from 'itty-router';

export class HyperDurable implements HyperDurable {
  constructor(state: DurableObjectState, env: Env) {
    this.id = state.id;
    this.state = state;
    this.storage = state.storage;
    this.router = Router();
    this.storageMap = new Map();

    // Traps for getting and setting props
    const handler = {
      get: (target, key, receiver) => {
        // Reserved key to confirm this is a proxy
        if (key === 'isProxy') return true;

        // console.log(`Getting ${target}.${key}`);

        const prop = target[key];

        // Recursively proxy any object-like properties, except state
        // This enables us to keep track of deeply-nested changes to props
        if (typeof prop === 'object' && !prop.isProxy && key !== 'state') {
          target[key] = new Proxy(prop, handler);
        }

        // If prop is a function, bind `this` to `receiver` (anything inheriting from HyperDurable)
        return typeof target[key] === 'function' ? target[key].bind(receiver) : target[key];
      },
      set: (target, key, value) => {
        // console.log(`Setting ${target}.${key} to equal ${value}`);
        
        // Set flag to persist data
        if (target[key] !== value) {
          this.state.dirty = true;
        }

        target[key] = value;
        return true;
      }
    };

    const hyperProxy = new Proxy(this, handler);

    // All operations flow through this router
    this.router
      .get('/get/:key', () => {})
      .post('/set/:key', () => {})
      .post('/call/:key', () => {})
      .all('*', () => {});

    return hyperProxy;
  }

  async fetch(request: Request): Promise<Response> {}
}
