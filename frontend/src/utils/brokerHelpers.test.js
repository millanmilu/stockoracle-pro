import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiResponse } from '../components/broker-settings/brokerHelpers.js';

test('API response parser returns successful JSON', async () => {
  const response = new Response(JSON.stringify({ success: true }), { status: 200 });
  assert.deepEqual(await readApiResponse(response, 'Request failed.'), { success: true });
});

test('API response parser exposes backend validation messages', async () => {
  const response = new Response(JSON.stringify({ detail: 'API key is required.' }), { status: 422 });
  await assert.rejects(readApiResponse(response, 'Request failed.'), /API key is required/);
});

test('API response parser reports HTTP status when an error has no JSON body', async () => {
  const response = new Response('Unavailable', { status: 503 });
  await assert.rejects(readApiResponse(response, 'Request failed.'), /Request failed\. \(HTTP 503\)/);
});
