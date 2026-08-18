import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = __dirname;

describe('InspectionDrawerComponent template', () => {
  const html = readFileSync(join(dir, 'inspection-drawer.component.html'), 'utf8');
  const css = readFileSync(join(dir, 'inspection-drawer.component.css'), 'utf8');

  it('is a complementary panel, not a modal dialog', () => {
    expect(html).toContain('role="complementary"');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('onBackdrop');
    expect(html).not.toContain('class="overlay"');
  });

  it('does not blur or dim the dashboard behind the drawer', () => {
    expect(css).not.toContain('backdrop-filter');
    expect(css).not.toContain('--prc-overlay');
    expect(css).toContain('box-shadow');
  });
});
