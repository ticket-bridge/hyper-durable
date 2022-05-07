import { Router } from 'itty-router';
import { DurableObjectState, DurableObjectStorage } from '@miniflare/durable-objects';

interface HyperState extends DurableObjectState {
  dirty?: Set<string>;
  savedKey?: string;
}

export class HyperDurable implements DurableObject {
  readonly isProxy?: boolean;
  id: DurableObjectId | string;
  state: HyperState;
  storage: DurableObjectStorage;
  router: Router;

  constructor(state: DurableObjectState, env: unknown) {
    this.id = state.id;
    this.state = state;
    this.state.dirty = new Set();
    this.state.savedKey = '';
    this.storage = state.storage;
    this.router = Router();

    // Traps for getting and setting props
    const handler = {
      get: (target: any, key: string, receiver: any) => {
        // Reserved key to confirm this is a proxy
        if (key === 'isProxy') return true;

        // console.log(`Getting ${target}.${typeof key === 'string' ? key : 'unknown'}`);

        const prop = target[key];

        // Recursively proxy any object-like properties, except state
        // This enables us to keep track of deeply-nested changes to props
        if (typeof prop === 'object' && !prop.isProxy && key !== 'state') {
          target[key] = new Proxy(prop, handler);
        }

        // If we're getting a proxied top-level property of the Durable Object,
        // save the key to persist the deeply-nested property
        if (target[key].isProxy && this === target) this.state.savedKey = key;

        // If prop is a function, bind `this`
        return typeof target[key] === 'function' ? target[key].bind(receiver) : target[key];
      },
      set: (target: any, key: string, value: any) => {
        // console.log(`Setting ${target}.${key} to equal ${value}`);
        
        // Add key to persist data 
        if (target[key] !== value) {
          if (this === target) {
            this.state.dirty.add(key);
          } else {
            this.state.dirty.add(this.state.savedKey);
          }
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

  // Removes all dirty props from Set (they won't be persisted)
  async clear(): Promise<boolean> {
    this.state.dirty.clear();
    return new Promise(() => true);
  }

  async persist(): Promise<string> {
    return new Promise(() => 'true');
  }

  async fetch(request: Request): Promise<Response> {
    return new Response();
  }
}
