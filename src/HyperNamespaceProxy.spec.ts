import { expect } from 'chai';

import { proxyDurable, proxyHyperDurables } from './HyperNamespaceProxy';

describe('proxyDurable', () => {
  test('returns a DurableObjectNamespace', () => {
    expect(proxyDurable('TODO').get).to.be.a('function');
  });
});

describe('proxyHyperDurables', () => {

});
