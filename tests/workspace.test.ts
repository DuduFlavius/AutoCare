import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  translationSource,
  workspaceSections,
  workspaceGroups,
  normalizeWorkspaceTab,
  workspaceHref,
  normalizeWorkspaceSearch,
} from '../src/lib/workspace';
test('Application navigation preserves every existing functional section, including mileage', () => {
  const expected = [
    'Dashboard',
    'Garaj',
    'Documente',
    'Calendar',
    'Întreținere',
    'Plan întreținere',
    'Kilometraj',
    'Cheltuieli',
    'Centru de suport',
    'Istoric auto',
    'Notificări',
    'Abonament',
    'Premium',
    'Setări',
  ];
  assert.deepEqual(new Set(workspaceSections.map((s) => s.id)), new Set(expected));
  assert.equal(new Set(workspaceSections.map((s) => s.id)).size, expected.length);
  for (const section of workspaceSections) {
    assert.ok(workspaceGroups.some((g) => g.id === section.group));
    assert.ok(section.ro && section.en);
  }
});
test('Existing bookmarked names recover to valid application sections', () => {
  assert.equal(normalizeWorkspaceTab('Premium'), 'Premium');
  assert.equal(normalizeWorkspaceTab('SmartDrive GPS'), 'Plan întreținere');
  assert.equal(normalizeWorkspaceTab('Kilometraj'), 'Kilometraj');
  assert.equal(normalizeWorkspaceTab('unknown'), 'Dashboard');
  assert.equal(normalizeWorkspaceTab(null), 'Dashboard');
});
test('Section links preserve preview paths and unrelated parameters without injecting another host', () => {
  assert.equal(
    workspaceHref('/previzualizare?echipa=1', 'Întreținere'),
    '/previzualizare?echipa=1&tab=%C3%8Entre%C8%9Binere',
  );
  assert.equal(workspaceHref('/cont?tab=Garaj', 'Calendar'), '/cont?tab=Calendar');
  assert.equal(workspaceHref('https://other.invalid/cont', 'Garaj'), '/cont?tab=Garaj');
  assert.equal(normalizeWorkspaceSearch('  ÎNTREȚINERE '), 'intretinere');
});

test('Translation follows a changed page title and can restore Romanian after English',()=>{
 const previous={source:'Acasă',rendered:'Home'};
 assert.equal(translationSource('Home',previous),'Acasă');
 assert.equal(translationSource('Setări',previous),'Setări');
 assert.equal(translationSource('Settings',{source:'Setări',rendered:'Settings'}),'Setări');
 assert.equal(translationSource('Date noi',undefined),'Date noi');
});
