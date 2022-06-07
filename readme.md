# HyperDurable

HyperDurable is a base class for Durable Objects to enable natural, object-like access to underlying persistent storage from Durable Object stubs.  HyperDurable completely abstracts the Durable Object fetch API, improving code readability in business logic layers.

- Abstracts away Durable Object fetch API
- Automatically persists dirty data
- Built with TypeScript
- Comprehensive test suite

## Usage

Write your durable object class by extending the `HyperDurable` base class.  In the constructor, pass the `state` and `env` to `HyperDurable` via `super()`.  `HyperDurable` will load all previously persisted data into memory inside its `fetch`, so any properties you set in the constructor after calling `super()` will be overriden by any previously persisted data.

Inside your durable object, access properties and methods in memory using `this`.  No need to worry about persistence- dirty data is persisted at the end of every fetch request.

```javascript
// RubberDuck.js
import { HyperDurable } from 'hyper-durable';

export class RubberDuck extends HyperDurable {
  constructor(state, env) {
    // Pass state and env to HyperDurable
    super(state, env);

    // Anything set here will be overriden by previously persisted data, if any exists
    // Therefore, you can safely set default values here
    this.name = 'New Duck';
    this.favoriteFoods = [];
  }

  addFavoriteFood(food) {
    this.favoriteFoods.push(food);
  }

  sayHello() {
    return `Hello world, my name is ${this.name}, and I have ${this.favoriteFoods.length} favorite foods.`;
  }
}
```

In your worker, first proxy your durable object namespaces with `proxyHyperDurables`.  Obtaining a stub is unchanged: generate your id with your preferred method from the namespace API (i.e., `newUniqueId`, `idFromName`, `idFromString`), then use `get` to construct an object stub.

Every stub operation must be `await`ed, since they all use the `fetch` API under the hood.  Properties can be read directly from the stub.  Properties can be set with their auto-generated setters (in the format `set` + `PropName`).  Methods can be called directly from the stub.

```javascript
// worker.js
import { proxyHyperDurables } from 'hyper-durable';
import { RubberDuck } from './RubberDuck';

export default {
  async fetch(request, env) {
    // Proxy the namespace
    const { RUBBERDUCK } = proxyHyperDurables(env, {
      // BINDINGNAME: DurableObjectClass
      RUBBERDUCK: RubberDuck
    });

    // Obtain a stub
    const id = RUBBERDUCK.idFromName('firstDuck');
    const stub = RUBBERDUCK.get(id);

    // Await properties
    const name = await stub.name; // 'New Duck'

    // Await setters
    const newName = await stub.setName('Special Duck'); // 'Special Duck'

    // Await methods
    await Promise.all([
      stub.addFavoriteFood('herring'),
      stub.addFavoriteFood('shrimp')
    ]);
    const greeting = await stub.sayHello(); // 'Hello world, my name is Special Duck, and I have 2 favorite foods.'
  
    return new Response(greeting);
  }
}
```

## API

### HyperDurable

Use as the base class of your durable object.  Includes some properties and methods by default, which are described below.

#### `env: Env`

The `env` passed in the constructor.

#### `state: HyperState`

The `state` passed in the constructor, plus:

##### `state.dirty: Set<string>`

Set of properties that have been changed in memory but are not yet persisted.

##### `state.persisted: Set<string>`

Set of properties that are persisted in Durable Object storage.

##### `state.tempKey: string`

Used to track the key of a deeply-nested property (i.e., when accessing `this.favoriteFoods[0]`, `state.tempKey` is `favoriteFoods`).

#### `storage: DurableObjectStorage`

Durable Object storage, from `state.storage`.

#### `router: Router`

An [itty-router](https://www.npmjs.com/package/itty-router) to handle incoming fetch requests.

#### `async initialize()`

Initializes loading if loading has not already begun.

#### `async load()`

Loads persisted data into memory.

#### `async persist()`

Persists dirty properties.

#### `async destroy()`

Deletes all data in `storage`, clears `state.dirty` and `state.persisted`, and deletes all properties from memory.

#### `async fetch(request: Request): Promise<Response>`

Initializes the object (if not previously initialized), then passes the request to `router`.  After `router` handles the request, persists and dirty data.

### `proxyHyperDurables(env: Env, doBindings: { [key: string]: doClass })`

Use to proxy your durable object namespaces.  Accepts two parameters: `env` and `doBindings`.  `env` is the `env` of your worker where namespaces are accessed.  `doBindings` is an object, where the keys are *binding names* and the values are the *durable object classes* associated with those binding.  Returns an object, where the keys are the passed *binding names* and the values are the associated *HyperNamespaceProxy*.

#### HyperNamespaceProxy

Use to generate object IDs and get object stubs, just as in the upstream [DurableObjectNamespace API](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/#accessing-a-durable-object-from-a-worker).

### HyperStub

Produced by `HyperNamespaceProxy.get(id)`.  The `fetch` method can be accessed directly, as in the upstream [API](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/#sending-http-requests).  The stub also allows for simple access to properties and methods.

To get a property, `await` it:

```javascript
await stub.name;
```

To set a property, `await` the auto-generated setter (returns the new value):

```javascript
await stub.setName('Eendje');
```

To invoke a method, `await` it (if a method has no return value, it will return `null`):

```javascript
await stub.sayHello();
```

Stub properties and methods will return their value directly in the event of a success.  If the operation fails, they will instead return an object with the following structure:

```javascript
{
  errors: [
    {
      message: 'Error message',
      details: 'Error details'
    }
  ]
}
```

## Special Thanks

This library was heavily inspired by [itty-durable](https://github.com/kwhitley/itty-durable) from [Kevin Whitley](https://github.com/kwhitley).
