import { expect } from 'chai';

import { HyperError } from './HyperError';

describe('HyperError', () => {
  test('contains name, message, details, allowed methods, and status code', () => {
    const error = new HyperError('Something went wrong', {
      details: 'Try 42 instead',
      status: 500,
      allow: 'POST'
    });
    expect(error).to.be.instanceOf(HyperError);
    expect(error.name).to.equal('HyperError');
    expect(error.message).to.equal('Something went wrong');
    expect(error.details).to.equal('Try 42 instead');
    expect(error.status).to.equal(500);
    expect(error.allow).to.equal('POST');
  });

  test('does not require options in constructor', () => {
    const error = new HyperError('Something else went wrong');
    expect(error).to.be.instanceOf(HyperError);
    expect(error.details).to.equal('');
    expect(error.status).to.equal(undefined);
    expect(error.allow).to.equal(undefined);
  });
});
