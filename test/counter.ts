import { HyperDurable } from '../src/HyperDurable';

export class Counter extends HyperDurable<Env> {
  abc?: number;
  counter: number;
  objectLikeProp: string[];

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.counter = 1;
    this.objectLikeProp = [];
  }

  increment() {
    this.counter++;
  }

  sayHello(name: string) {
    return `Hello ${name}!`;
  }

  throws() {
    throw new Error('Mistake');
  }
}
