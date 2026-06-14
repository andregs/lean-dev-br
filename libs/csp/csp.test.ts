import { describe, expect, it } from 'vitest';
import { cspDirectives, trustedTypesDirective, cspHeader } from './index.js';

describe('cspDirectives', () => {
  it('shares one baseline; dev only adds localhost/HMR to connect-src', () => {
    const prod = cspDirectives({ mode: 'prod' });
    const dev = cspDirectives({ mode: 'dev' });

    // Every prod directive/value is preserved in dev (single source of truth).
    for (const [name, values] of Object.entries(prod)) {
      expect(dev[name]).toEqual(expect.arrayContaining(values));
    }
    // Dev differs from prod only by the connect-src localhost/ws additions.
    expect(dev['connect-src']).toEqual([
      ...prod['connect-src'],
      'ws://localhost:*',
      'http://localhost:*',
    ]);
    const prodRest = { ...prod };
    const devRest = { ...dev };
    delete prodRest['connect-src'];
    delete devRest['connect-src'];
    expect(devRest).toEqual(prodRest);
  });

  it('locks down the security-relevant sources', () => {
    const prod = cspDirectives({ mode: 'prod' });
    expect(prod['default-src']).toEqual(["'self'"]);
    expect(prod['script-src']).toContain("'self'");
    expect(prod['script-src']).toContain('https://www.gstatic.com');
    expect(prod['connect-src']).toContain('https://cognito-identity.us-east-1.amazonaws.com');
    expect(prod['connect-src']).toContain('https://dataplane.rum.us-east-1.amazonaws.com');
    // No localhost leaks into prod.
    expect(prod['connect-src'].some((s) => s.includes('localhost'))).toBe(false);
  });

  it("blog adds 'unsafe-inline' to script-src (Next inline hydration); apex does not", () => {
    const apex = cspDirectives({ mode: 'prod' });
    const blog = cspDirectives({ mode: 'prod', app: 'blog' });
    expect(apex['script-src']).not.toContain("'unsafe-inline'");
    expect(blog['script-src']).toContain("'unsafe-inline'");
    // Only script-src differs; the rest of the policy is identical to apex.
    const apexRest = { ...apex };
    const blogRest = { ...blog };
    delete apexRest['script-src'];
    delete blogRest['script-src'];
    expect(blogRest).toEqual(apexRest);
  });
});

describe('todo CSP', () => {
  it('no reCAPTCHA domains in script-src or connect-src; RUM + Cognito still present', () => {
    const prod = cspDirectives({ mode: 'prod', app: 'todo', signalUrl: 'https://signal.example.com' });
    expect(prod['script-src']).toEqual(["'self'"]);
    expect(prod['connect-src']).not.toContain('https://www.google.com');
    expect(prod['connect-src']).toContain('https://dataplane.rum.us-east-1.amazonaws.com');
    expect(prod['connect-src']).toContain('https://cognito-identity.us-east-1.amazonaws.com');
    expect(prod['connect-src']).toContain('https://signal.example.com');
    expect(prod['frame-src']).toBeUndefined();
  });

  it('signalUrl omitted → connect-src has RUM + Cognito but no signal URL', () => {
    const prod = cspDirectives({ mode: 'prod', app: 'todo' });
    expect(prod['connect-src']).toEqual([
      "'self'",
      'https://dataplane.rum.us-east-1.amazonaws.com',
      'https://cognito-identity.us-east-1.amazonaws.com',
    ]);
  });

  it('dev mode appends localhost entries after signalUrl', () => {
    const dev = cspDirectives({ mode: 'dev', app: 'todo', signalUrl: 'https://signal.example.com' });
    expect(dev['connect-src']).toContain('ws://localhost:*');
    expect(dev['connect-src']).toContain('http://localhost:*');
    expect(dev['connect-src'].indexOf('https://signal.example.com')).toBeLessThan(
      dev['connect-src'].indexOf('ws://localhost:*'),
    );
  });

  it('prod header enforces Trusted Types and includes signal URL', () => {
    const header = cspHeader({ mode: 'prod', app: 'todo', signalUrl: 'https://signal.example.com' });
    expect(header).toContain("require-trusted-types-for 'script'");
    expect(header).toContain('https://signal.example.com');
    expect(header).not.toContain('gstatic');
    expect(header).not.toContain('frame-src');
  });
});

describe('trustedTypesDirective', () => {
  it('requires TT for script and allowlists exactly the known policies', () => {
    const tt = trustedTypesDirective();
    expect(tt).toContain("require-trusted-types-for 'script'");
    expect(tt).toContain('trusted-types app dompurify default goog#html');
  });
});

describe('cspHeader', () => {
  it('prod enforces Trusted Types inline', () => {
    const header = cspHeader({ mode: 'prod' });
    expect(header).toContain("default-src 'self'");
    expect(header).toContain("require-trusted-types-for 'script'");
    expect(header).toContain('trusted-types app dompurify default goog#html');
  });

  it('blog prod allows inline scripts and enforces TT with the nextjs policy allowlisted', () => {
    const header = cspHeader({ mode: 'prod', app: 'blog' });
    expect(header).toContain("script-src 'self' https://www.google.com https://www.gstatic.com 'unsafe-inline'");
    expect(header).toContain("require-trusted-types-for 'script'");
    // Next's own pass-through policy must be allowed (it drives chunk loading).
    expect(header).toContain('nextjs');
  });

  it('dev omits Trusted Types (shipped separately as report-only) and adds HMR', () => {
    const header = cspHeader({ mode: 'dev' });
    expect(header).not.toContain('require-trusted-types-for');
    expect(header).not.toContain('trusted-types ');
    expect(header).toContain('ws://localhost:*');
  });

  it('serializes as "name value; name value" directive pairs', () => {
    const header = cspHeader({ mode: 'prod' });
    const segments = header.split('; ');
    expect(segments[0]).toBe("default-src 'self'");
    // every segment is a directive name followed by at least one value
    for (const seg of segments) {
      expect(seg).toMatch(/^[a-z-]+ .+/);
    }
  });
});
