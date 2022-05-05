# HyperDurable

HyperDurable is a base class for Durable Objects to enable natural, object-like access to underlying persistent storage from Durable Object stubs.  HyperDurable completely abstracts the Durable Object fetch API, improving code readability in business logic layers.

## Usage

**NOTE: This is currently aspirational**

Write your durable object class by extending the `HyperDurable` base class.  In the constructor, pass the `state` and `env` to `HyperDurable` via `super()`.  `HyperDurable` will load all previously persisted data into memory inside its constructor, so any properties you set *after* calling `super()` will override any data in memory.

```javascript
import { HyperDurable } from 'hyper-durable';

export class Ticket extends HyperDurable {
  constructor(state, env) {
    // Pass state and env to HyperDurable
    super(state, env);

    // If there is no persisted data, this will be true
    if (this.state.isEmptyObject) this.setup();
  }

  setup() {
    this.txHashes = [];
  }

  registerTx(txHash, ownedByUserId) {
    this.txHashes.push(txHash);
    this.ownedByUserId = ownedByUserId;
  }
}
```
