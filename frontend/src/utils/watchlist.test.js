import test from 'node:test';
import assert from 'node:assert/strict';
import { addToWatchlist, readWatchlist, WATCHLIST_STORAGE_KEY } from './watchlist.js';

test('readWatchlist falls back to the default list when storage is empty', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
  };

  try {
    const items = readWatchlist(['RELIANCE', 'TCS']);
    assert.deepEqual(items, ['RELIANCE', 'TCS']);
  } finally {
    globalThis.localStorage = original;
  }
});

test('addToWatchlist keeps values unique and uppercase', () => {
  const original = globalThis.localStorage;
  const saved = [];
  globalThis.localStorage = {
    getItem: () => null,
    setItem: (_, value) => saved.push(value),
  };

  try {
    const next = addToWatchlist('reliance', ['RELIANCE']);
    assert.deepEqual(next, ['RELIANCE']);
    assert.equal(saved.length, 0);

    const second = addToWatchlist('INFY', ['RELIANCE']);
    assert.deepEqual(second, ['RELIANCE', 'INFY']);
  } finally {
    globalThis.localStorage = original;
  }
});

test('readWatchlist reads the saved storage key', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => key === WATCHLIST_STORAGE_KEY ? JSON.stringify(['HDFCBANK', 'INFY']) : null,
    setItem: () => {},
  };

  try {
    const items = readWatchlist(['RELIANCE']);
    assert.deepEqual(items, ['HDFCBANK', 'INFY']);
  } finally {
    globalThis.localStorage = original;
  }
});
