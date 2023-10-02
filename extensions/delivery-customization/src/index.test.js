import { describe, it, expect } from 'vitest';
import deliveryCustomization from './index';

/**
 * @typedef {import("../generated/api").FunctionResult} FunctionResult
 */

describe('delivery customization function', () => {
  it('returns no operations without configuration', () => {
    const result = deliveryCustomization({
      deliveryCustomization: {
        metafield: null
      }
    });
    const expected = /** @type {FunctionResult} */ ({ operations: [] });

    expect(result).toEqual(expected);
  });
});