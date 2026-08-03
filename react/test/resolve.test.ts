import { describe, expect, it } from 'vitest';

import { interpolate, resolve } from '../src/resolve.js';
import type { Resources } from '../src/types.js';

const resources: Resources = {
  en: { hello: 'Hello', greet: 'Hi, {{name}}', only_en: 'English only' },
  ru: { hello: 'Привет', greet: 'Привет, {{ name }}' },
};

describe('interpolate', () => {
  it('substitutes placeholders, with or without inner whitespace', () => {
    expect(interpolate('Hi, {{name}}', { name: 'Nikita' })).toBe('Hi, Nikita');
    expect(interpolate('Hi, {{ name }}', { name: 'Nikita' })).toBe('Hi, Nikita');
  });

  it('stringifies numbers', () => {
    expect(interpolate('{{count}} items', { count: 3 })).toBe('3 items');
  });

  it('leaves unknown placeholders verbatim rather than blanking them', () => {
    expect(interpolate('Hi, {{name}}', { other: 'x' })).toBe('Hi, {{name}}');
  });

  it('is a no-op without vars', () => {
    expect(interpolate('Hi, {{name}}')).toBe('Hi, {{name}}');
  });
});

describe('resolve', () => {
  it('finds a key in the active locale', () => {
    expect(resolve(resources, 'ru', 'en', 'hello')).toBe('Привет');
  });

  it('falls through to the fallback locale', () => {
    expect(resolve(resources, 'ru', 'en', 'only_en')).toBe('English only');
  });

  it('echoes the key when nothing matches', () => {
    expect(resolve(resources, 'ru', 'en', 'checkout_title')).toBe('checkout_title');
  });

  it('echoes the key when there is no fallback configured', () => {
    expect(resolve(resources, 'ru', undefined, 'only_en')).toBe('only_en');
  });

  it('returns an empty string for null, undefined and empty keys', () => {
    expect(resolve(resources, 'en', 'en', null)).toBe('');
    expect(resolve(resources, 'en', 'en', undefined)).toBe('');
    expect(resolve(resources, 'en', 'en', '')).toBe('');
  });

  it('interpolates the hit from either locale', () => {
    expect(resolve(resources, 'en', undefined, 'greet', { name: 'Nikita' })).toBe('Hi, Nikita');
    expect(resolve(resources, 'ru', 'en', 'greet', { name: 'Nikita' })).toBe('Привет, Nikita');
  });

  it('handles an unknown active locale by using the fallback', () => {
    expect(resolve(resources, 'de', 'en', 'hello')).toBe('Hello');
  });

  it('does not consult the fallback when it is the active locale', () => {
    expect(resolve(resources, 'en', 'en', 'missing')).toBe('missing');
  });
});
