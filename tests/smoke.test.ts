import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

for (const page of ['index.html', 'catalogue.html', 'exercise.html']) {
  test(`${page} has landmarks, skip link and glass filter`, () => {
    const html = readFileSync(page, 'utf8')
    expect(html).toMatch(/<html lang="en"/)
    expect(html).toContain('class="skip-link"')
    expect(html).toMatch(/<main id="main"/)
    expect(html).toContain('id="glass-distort"')
  })
}
