import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoPointQuery, parseAutoPoints } from '../src/lib/auto-points';

test('auto point lookup uses a bounded category query and approximate map center', () => {
  assert.match(autoPointQuery(45.7512345, 21.2291234, 'charging'), /around:4000,45\.75,21\.23/);
  assert.match(autoPointQuery(45, 21, 'service'), /\["shop"="car_repair"\]/);
  assert.match(autoPointQuery(45, 21, 'parking'), /\["amenity"="parking"\]/);
  assert.match(autoPointQuery(45, 21, 'fuel'), /out center 120/);
});

test('auto point parsing handles node coordinates and way centers, rejecting invalid objects', () => {
  const points = parseAutoPoints(
    {
      elements: [
        { type: 'node', id: 1, lat: 45, lon: 21, tags: { name: '  Service local  ' } },
        { type: 'way', id: 1, center: { lat: 45.1, lon: 21.2 } },
        { type: 'node', id: 2, lat: 95, lon: 21 },
        { type: 'node', id: 3, lat: '45', lon: 21 },
      ],
    },
    'service',
  );
  assert.deepEqual(
    points.map(({ id, name }) => [id, name]),
    [
      ['node/1', 'Service local'],
      ['way/1', null],
    ],
  );
  assert.throws(() => parseAutoPoints({ error: 'provider failure' }, 'fuel'));
});
