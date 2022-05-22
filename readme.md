# HyperDurable

HyperDurable is a base class for Durable Objects to enable natural, object-like access to underlying persistent storage from Durable Object stubs.  HyperDurable completely abstracts the Durable Object fetch API, improving code readability in business logic layers.

## Usage

Write your durable object class by extending the `HyperDurable` base class.  In the constructor, pass the `state` and `env` to `HyperDurable` via `super()`.  `HyperDurable` will load all previously persisted data into memory inside its *fetch*, so any properties you set *after* calling `super()` will be overriden by any previously persisted data.

```javascript
import { HyperDurable } from 'hyper-durable';

export class RubberDuck extends HyperDurable {
  constructor(state, env) {
    // Pass state and env to HyperDurable
    super(state, env);

    // Anything set here will be overriden by previously persisted data, if any exists
    // Therefore, you can safely set default values here
    this.name = 'New Duck';
    this.nicknames = [];
  }

  giveNickname(nickname) {
    this.nicknames.push(nickname);
  }

  sayHello() {
    return `Hello world, my name is ${this.name}`
      + (this.nicknames.length > 0 ? `, but you can call me ${this.nicknames[0]}` : '');
  }
}
```
