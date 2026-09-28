import { readdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import type { AstroIntegration } from 'astro';

export interface Size {
  bytes: number;
  gzip: number;
}

/** dist/build-stats.json, which the This Table panel reads. */
export interface BuildStats {
  built: string;
  /** index.html, with its inlined CSS and scripts. */
  html: Size;
  /** The module scripts the HTML loads before idle, their static imports and the inline scripts. */
  firstPaintJs: Size;
  /**
   * Named after their files: each island with everything it goes on to load that neither the
   * React runtime nor the page's own scripts already bring; the runtime itself ("client"); what
   * the page scripts import later ("motion"); and each worker.
   */
  bundles: ({ name: string } & Size)[];
  totalJs: Size;
}

type Graph = Map<string, { imports: string[]; dynamicImports: string[] }>;

/** Every file the entries load: their static imports and, with dynamic, what they import later. */
export function reach(graph: Graph, entries: readonly string[], dynamic: boolean) {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const node = graph.get(file);
    node?.imports.forEach(visit);
    if (dynamic) node?.dynamicImports.forEach(visit);
  };
  entries.forEach(visit);
  return seen;
}

/** Writes dist/build-stats.json from the astro:build:done hook, with the bundle sizes the This Table panel shows. */
export default function buildStats(): AstroIntegration {
  // Which client chunk imports which, keyed by output file. Workers are built separately, so they aren't in it.
  const graph: Graph = new Map();

  return {
    name: 'build-stats',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'build-stats',
                applyToEnvironment: (environment) => environment.name === 'client',
                generateBundle(_, bundle) {
                  for (const file of Object.values(bundle)) {
                    if (file.type === 'chunk') graph.set(file.fileName, { imports: file.imports, dynamicImports: file.dynamicImports });
                  }
                },
              },
            ],
          },
        });
      },

      'astro:build:done': async ({ dir, logger }) => {
        const size = (data: string | Buffer): Size => ({ bytes: Buffer.byteLength(data), gzip: gzipSync(data, { level: 9 }).length });
        const sizes = new Map<string, Size>();
        for (const file of await readdir(new URL('_astro/', dir))) {
          if (file.endsWith('.js')) sizes.set(`_astro/${file}`, size(await readFile(new URL(`_astro/${file}`, dir))));
        }
        const total = (...parts: Size[]) => parts.reduce((sum, part) => ({ bytes: sum.bytes + part.bytes, gzip: sum.gzip + part.gzip }), { bytes: 0, gzip: 0 });
        const sum = (files: Iterable<string>) => total(...[...files].map((file) => sizes.get(file)!));
        const name = (file: string) => file.replace(/^_astro\//, '').replace(/[.-][\w-]{8}\.js$/, '');

        const html = await readFile(new URL('index.html', dir), 'utf8');
        const found = (pattern: RegExp) => [...new Set([...html.matchAll(pattern)].map((match) => match[1]))];
        const scripts = found(/<script type="module" src="\/([^"]+)"/g);
        const islands = found(/component-url="\/([^"]+)"/g);
        const renderers = found(/renderer-url="\/([^"]+)"/g);
        const inline = found(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g).join('\n');

        const firstPaint = reach(graph, scripts, false);
        const runtime = reach(graph, renderers, true);
        const later = [...firstPaint].flatMap((file) => graph.get(file)?.dynamicImports ?? []);
        const page = reach(graph, scripts, true);
        const loaded = reach(graph, [...scripts, ...islands, ...renderers], true);
        const without = (files: Set<string>, ...skip: Set<string>[]) => [...files].filter((file) => !skip.some((set) => set.has(file)));

        const stats: BuildStats = {
          built: new Date().toISOString(),
          html: size(html),
          firstPaintJs: total(sum(firstPaint), size(inline)),
          bundles: [
            ...islands.map((file) => ({ file, files: without(reach(graph, [file], true), runtime, page) })),
            ...renderers.map((file) => ({ file, files: [...runtime] })),
            ...later.map((file) => ({ file, files: without(reach(graph, [file], true), firstPaint) })),
            ...[...sizes.keys()].filter((file) => !loaded.has(file)).map((file) => ({ file, files: [file] })),
          ].map(({ file, files }) => ({ name: name(file), ...sum(files) })),
          totalJs: sum(sizes.keys()),
        };
        await writeFile(new URL('build-stats.json', dir), `${JSON.stringify(stats, null, 2)}\n`);

        const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
        const line = `build-stats.json written. First-paint JS is ${kb(stats.firstPaintJs.gzip)} gzipped`;
        if (stats.firstPaintJs.gzip > 50 * 1024) logger.warn(`${line}, over the 50 KB budget.`);
        else logger.info(`${line}.`);
      },
    },
  };
}
