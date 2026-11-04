/** Inline marker styling isolates GPS visibility from broad application card styles. */
export function createRoadPositionMarker(english = false): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'ac-road-position';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', english ? 'Your latest GPS position' : 'Ultima ta poziție GPS');
  const styles: Record<string,string> = {
    width:'28px',height:'28px','box-sizing':'border-box',background:'#1677ff',
    border:'4px solid #ffffff','border-radius':'50%',opacity:'1',
    'box-shadow':'0 0 0 7px rgba(22,119,255,.2), 0 3px 12px rgba(12,40,85,.45)',
    padding:'0',margin:'0','pointer-events':'none',
  };
  for (const [name,value] of Object.entries(styles)) element.style.setProperty(name,value,'important');
  return element;
}
