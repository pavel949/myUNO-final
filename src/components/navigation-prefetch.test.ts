import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// These screens render many DB-backed destinations at once. Merely displaying
// them must not fan out requests that compete with an actual navigation.
const surfaces = ["src/components/Navbar.tsx", "src/components/Footer.tsx", "src/components/WorkspaceNavigation.tsx", "src/components/ProjectCard.tsx", "src/components/ServiceCard.tsx", "src/components/PublicAnalyticsLink.tsx", "src/components/home/HomeOffersRail.tsx", "src/components/home/EcosystemEntry.tsx", "src/app/(public)/page.tsx", "src/app/(public)/projects/[slug]/page.tsx"];

describe('on-demand navigation on high-fanout surfaces', () => {
  it.each(surfaces)('%s disables speculative Link requests without removing links', path => {
    const source = ts.createSourceFile(path, readFileSync(resolve(path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let links = 0;
    function visit(node: ts.Node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'Link') {
        links++;
        const attribute = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'prefetch');
        expect(attribute && ts.isJsxAttribute(attribute) && attribute.initializer?.getText(source)).toBe('{false}');
        expect(node.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'href')).toBe(true);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(links).toBeGreaterThan(0);
  });
});
