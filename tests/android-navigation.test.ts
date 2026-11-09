import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Android background guidance follows the route and detects a missed turn', () => {
  const directory = mkdtempSync(join(tmpdir(), 'autocare-nav-'));
  try {
    const harness = join(directory, 'NavigationHarness.java');
    writeFileSync(harness, `
      package ro.autocare.tracking;
      public class NavigationHarness {
        public static void main(String[] args) {
          NavigationProgress.Step[] route = {
            new NavigationProgress.Step(new double[][]{{21,45},{21.01,45}}, 800, "Plecare"),
            new NavigationProgress.Step(new double[][]{{21.01,45},{21.01,45.01}}, 1100, "Virează la stânga"),
            new NavigationProgress.Step(new double[][]{{21.01,45.01}}, 0, "Ai ajuns")
          };
          var middle = NavigationProgress.at(route, 0, 45, 21.005);
          if (Math.abs(middle.untilTurn() - 400) > 1 || !middle.next().equals("Virează la stânga")) throw new AssertionError(middle);
          var turned = NavigationProgress.at(route, 0, 45.005, 21.01);
          if (turned.step() != 1 || Math.abs(turned.remaining() - 550) > 1) throw new AssertionError(turned);
          var missed = NavigationProgress.at(route, 1, 45.005, 21.03);
          if (missed.gap() < 1000) throw new AssertionError(missed);
          var arrived = NavigationProgress.at(route, 1, 45.01, 21.01);
          if (arrived.remaining() > 1 || arrived.gap() > 1) throw new AssertionError(arrived);
        }
      }`);
    const compile = spawnSync('javac', ['-d', directory, resolve('mobile/tracking/android/src/main/java/ro/autocare/tracking/NavigationProgress.java'), harness], { encoding: 'utf8' });
    assert.equal(compile.status, 0, compile.stderr);
    const run = spawnSync('java', ['-cp', directory, 'ro.autocare.tracking.NavigationHarness'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
