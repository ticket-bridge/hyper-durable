import { HyperDurable } from 'HyperDurable';

export class Counter extends HyperDurable {
  constructor(state, env) {
    super(state, env);
    this.counter = 1;
    this.objectLikeProp = [];
  }

  increment() {
    this.counter++;
  }

  sayHello(name) {
    return `Hello ${name}!`;
  }

  throws() {
    throw new Error('Mistake');
  }
}
