import { describe, it, expect } from 'vitest';
import { ClientRuntimeMock } from '@stagewise/agent-runtime-mock';
import { getFramework, Framework } from './get-framework.js';

describe('getFramework', () => {
  it('should detect Next.js framework with React', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/nextjs-app',
      initialFiles: {
        '/project/nextjs-app/package.json': JSON.stringify({
          name: 'nextjs-app',
          dependencies: {
            next: '13.5.0',
            react: '18.0.0',
            'react-dom': '18.0.0',
          },
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe('/project/nextjs-app');
    expect(result[0]!.metaFramework?.framework).toBe(Framework.NEXTJS);
    expect(result[0]!.metaFramework?.version).toBe('13.5.0');
    expect(result[0]!.metaFramework?.confidence).toBeGreaterThan(0.8);
    expect(result[0]!.frontendFramework?.framework).toBe(Framework.REACT);
    expect(result[0]!.frontendFramework?.version).toBe('18.0.0');
  });

  it('should detect Angular framework', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/angular-app',
      initialFiles: {
        '/project/angular-app/package.json': JSON.stringify({
          name: 'angular-app',
          dependencies: {
            '@angular/core': '^16.0.0',
            '@angular/common': '^16.0.0',
            '@angular/platform-browser': '^16.0.0',
          },
          devDependencies: {
            '@angular/cli': '^16.0.0',
          },
          scripts: {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.frontendFramework?.framework).toBe(Framework.ANGULAR);
    expect(result[0]!.frontendFramework?.version).toBe('^16.0.0');
    expect(result[0]!.metaFramework).toBeUndefined();
  });

  it('should detect Vue.js with Vite', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/vue-app',
      initialFiles: {
        '/project/vue-app/package.json': JSON.stringify({
          name: 'vue-app',
          dependencies: {
            vue: '^3.3.0',
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^4.0.0',
            vite: '^4.5.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.frontendFramework?.framework).toBe(Framework.VUE);
    expect(result[0]!.frontendFramework?.version).toBe('^3.3.0');
    expect(result[0]!.buildTool?.framework).toBe(Framework.VITE);
    expect(result[0]!.buildTool?.version).toBe('^4.5.0');
  });

  it('should detect Nuxt.js with Vue.js', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/nuxt-app',
      initialFiles: {
        '/project/nuxt-app/package.json': JSON.stringify({
          name: 'nuxt-app',
          dependencies: {
            nuxt: '^3.8.0',
            vue: '^3.3.0',
          },
          scripts: {
            dev: 'nuxt dev',
            build: 'nuxt build',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.metaFramework?.framework).toBe(Framework.NUXTJS);
    expect(result[0]!.metaFramework?.version).toBe('^3.8.0');
    // Vue should not be detected when Nuxt is present (due to custom check)
    expect(result[0]!.frontendFramework).toBeUndefined();
  });

  it('should detect SvelteKit with Svelte', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/sveltekit-app',
      initialFiles: {
        '/project/sveltekit-app/package.json': JSON.stringify({
          name: 'sveltekit-app',
          devDependencies: {
            '@sveltejs/kit': '^1.20.0',
            '@sveltejs/adapter-auto': '^2.0.0',
            svelte: '^4.0.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.metaFramework?.framework).toBe(Framework.SVELTEKIT);
    expect(result[0]!.metaFramework?.version).toBe('^1.20.0');
    // Svelte should not be detected when SvelteKit is present (due to custom check)
    expect(result[0]!.frontendFramework).toBeUndefined();
  });

  it('should detect SolidStart with Solid.js', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/solid-app',
      initialFiles: {
        '/project/solid-app/package.json': JSON.stringify({
          name: 'solid-app',
          dependencies: {
            '@solidjs/start': '^0.3.0',
            'solid-js': '^1.8.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.metaFramework?.framework).toBe(Framework.SOLIDSTART);
    expect(result[0]!.metaFramework?.version).toBe('^0.3.0');
    // Solid should not be detected when SolidStart is present (due to custom check)
    expect(result[0]!.frontendFramework).toBeUndefined();
  });

  it('should detect React with Vite and Jest', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/react-app',
      initialFiles: {
        '/project/react-app/package.json': JSON.stringify({
          name: 'react-app',
          dependencies: {
            react: '18.2.0',
            'react-dom': '18.2.0',
          },
          devDependencies: {
            '@vitejs/plugin-react': '^4.0.0',
            vite: '^4.5.0',
            jest: '^29.0.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.frontendFramework?.framework).toBe(Framework.REACT);
    expect(result[0]!.frontendFramework?.version).toBe('18.2.0');
    expect(result[0]!.buildTool?.framework).toBe(Framework.VITE);
    expect(result[0]!.testingFramework?.framework).toBe(Framework.JEST);
  });

  it('should detect Express backend', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/express-api',
      initialFiles: {
        '/project/express-api/package.json': JSON.stringify({
          name: 'express-api',
          dependencies: {
            express: '^4.18.0',
            cors: '^2.8.5',
          },
          devDependencies: {
            jest: '^29.0.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.backendFramework?.framework).toBe(Framework.EXPRESS);
    expect(result[0]!.backendFramework?.version).toBe('^4.18.0');
    expect(result[0]!.testingFramework?.framework).toBe(Framework.JEST);
    expect(result[0]!.frontendFramework).toBeUndefined();
  });

  it('should detect NestJS backend', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/nestjs-api',
      initialFiles: {
        '/project/nestjs-api/package.json': JSON.stringify({
          name: 'nestjs-api',
          dependencies: {
            '@nestjs/core': '^10.0.0',
            '@nestjs/common': '^10.0.0',
          },
          devDependencies: {
            jest: '^29.0.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.backendFramework?.framework).toBe(Framework.NESTJS);
    expect(result[0]!.backendFramework?.version).toBe('^10.0.0');
    expect(result[0]!.testingFramework?.framework).toBe(Framework.JEST);
  });

  it('should detect only build tools when no frameworks present', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/build-only',
      initialFiles: {
        '/project/build-only/package.json': JSON.stringify({
          name: 'build-only',
          devDependencies: {
            webpack: '^5.0.0',
            'webpack-cli': '^5.0.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.buildTool?.framework).toBe(Framework.WEBPACK);
    expect(result[0]!.buildTool?.version).toBe('^5.0.0');
    expect(result[0]!.frontendFramework).toBeUndefined();
    expect(result[0]!.backendFramework).toBeUndefined();
  });

  it('should detect only testing frameworks', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/test-only',
      initialFiles: {
        '/project/test-only/package.json': JSON.stringify({
          name: 'test-only',
          devDependencies: {
            vitest: '^0.34.0',
            '@vitest/ui': '^0.34.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.testingFramework?.framework).toBe(Framework.VITEST);
    expect(result[0]!.testingFramework?.version).toBe('^0.34.0');
    expect(result[0]!.frontendFramework).toBeUndefined();
  });

  it('should handle monorepo with multiple framework types', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/workspace/monorepo',
      initialFiles: {
        '/workspace/monorepo/package.json': JSON.stringify({
          name: 'monorepo',
          private: true,
        }),
        '/workspace/monorepo/apps/web/package.json': JSON.stringify({
          name: 'web',
          dependencies: {
            next: '13.5.0',
            react: '18.0.0',
          },
          devDependencies: {
            jest: '^29.0.0',
          },
        }),
        '/workspace/monorepo/apps/mobile/package.json': JSON.stringify({
          name: 'mobile',
          dependencies: {
            react: '18.0.0',
            'react-native': '0.72.0',
          },
          devDependencies: {
            jest: '^29.0.0',
          },
        }),
        '/workspace/monorepo/packages/api/package.json': JSON.stringify({
          name: 'api',
          dependencies: {
            '@nestjs/core': '^10.0.0',
            '@nestjs/common': '^10.0.0',
          },
          devDependencies: {
            jest: '^29.0.0',
          },
        }),
        '/workspace/monorepo/packages/ui/package.json': JSON.stringify({
          name: 'ui',
          dependencies: {
            react: '18.0.0',
          },
          devDependencies: {
            vite: '^4.5.0',
            vitest: '^0.34.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(4); // 4 packages (root has no framework)

    // Web app: Next.js + React + Jest
    const webApp = result.find((r) => r.path.includes('/apps/web'));
    expect(webApp?.metaFramework?.framework).toBe(Framework.NEXTJS);
    expect(webApp?.frontendFramework?.framework).toBe(Framework.REACT);
    expect(webApp?.testingFramework?.framework).toBe(Framework.JEST);

    // Mobile app: React + Jest
    const mobileApp = result.find((r) => r.path.includes('/apps/mobile'));
    expect(mobileApp?.frontendFramework?.framework).toBe(Framework.REACT);
    expect(mobileApp?.testingFramework?.framework).toBe(Framework.JEST);
    expect(mobileApp?.metaFramework).toBeUndefined();

    // API: NestJS + Jest
    const apiPackage = result.find((r) => r.path.includes('/packages/api'));
    expect(apiPackage?.backendFramework?.framework).toBe(Framework.NESTJS);
    expect(apiPackage?.testingFramework?.framework).toBe(Framework.JEST);
    expect(apiPackage?.frontendFramework).toBeUndefined();

    // UI: React + Vite + Vitest
    const uiPackage = result.find((r) => r.path.includes('/packages/ui'));
    expect(uiPackage?.frontendFramework?.framework).toBe(Framework.REACT);
    expect(uiPackage?.buildTool?.framework).toBe(Framework.VITE);
    expect(uiPackage?.testingFramework?.framework).toBe(Framework.VITEST);
  });

  it('should handle projects without package.json', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/no-package',
      initialFiles: {
        '/project/no-package/README.md': '# No package.json here',
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(0);
  });

  it('should handle malformed package.json gracefully', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/malformed',
      initialFiles: {
        '/project/malformed/package.json': '{invalid json}',
        '/project/malformed/apps/valid/package.json': JSON.stringify({
          name: 'valid-app',
          dependencies: {
            react: '18.0.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    // Should skip malformed but include valid ones
    expect(result).toHaveLength(1);
    expect(result[0]!.frontendFramework?.framework).toBe(Framework.REACT);
  });

  it('should handle multiple frameworks in same category (choose highest confidence)', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/multi-same-category',
      initialFiles: {
        '/project/multi-same-category/package.json': JSON.stringify({
          name: 'multi-same-category',
          dependencies: {
            vue: '3.0.0', // Lower confidence
          },
          devDependencies: {
            '@angular/core': '^16.0.0', // Higher confidence due to scripts
            '@angular/cli': '^16.0.0',
          },
          scripts: {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    // Should detect Angular (higher confidence) over Vue
    expect(result[0]!.frontendFramework?.framework).toBe(Framework.ANGULAR);
  });

  it('should handle version cleaning correctly', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/version-test',
      initialFiles: {
        '/project/version-test/package.json': JSON.stringify({
          name: 'version-test',
          dependencies: {
            react: '^18.2.0',
          },
          devDependencies: {
            vite: '~4.5.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.frontendFramework?.framework).toBe(Framework.REACT);
    expect(result[0]!.frontendFramework?.version).toBe('^18.2.0'); // Should preserve ^ prefix
    expect(result[0]!.buildTool?.version).toBe('~4.5.0'); // Should preserve ~ prefix
  });

  it('should handle framework detection with scripts only', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/scripts-only',
      initialFiles: {
        '/project/scripts-only/package.json': JSON.stringify({
          name: 'scripts-only',
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
          },
          // No dependencies, only scripts
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    expect(result[0]!.metaFramework?.framework).toBe(Framework.NEXTJS);
    expect(result[0]!.metaFramework?.confidence).toBeGreaterThan(0); // Should have some confidence from scripts
  });

  it('should handle empty package.json', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/empty',
      initialFiles: {
        '/project/empty/package.json': JSON.stringify({
          name: 'empty-project',
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(0); // No frameworks detected
  });

  it('should sort results by path consistently', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/workspace/sorted',
      initialFiles: {
        '/workspace/sorted/package.json': JSON.stringify({ name: 'root' }),
        '/workspace/sorted/packages/z-package/package.json': JSON.stringify({
          name: 'z-package',
          dependencies: { react: '18.0.0' },
        }),
        '/workspace/sorted/packages/a-package/package.json': JSON.stringify({
          name: 'a-package',
          dependencies: { vue: '3.0.0' },
        }),
        '/workspace/sorted/apps/b-app/package.json': JSON.stringify({
          name: 'b-app',
          dependencies: { next: '13.0.0' },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(3); // Should exclude root (no framework)

    // Results should be sorted by path
    expect(result[0]!.path).toBe('/workspace/sorted/apps/b-app');
    expect(result[1]!.path).toBe('/workspace/sorted/packages/a-package');
    expect(result[2]!.path).toBe('/workspace/sorted/packages/z-package');
  });

  it('should handle co-existing frameworks in different categories', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/project/full-stack',
      initialFiles: {
        '/project/full-stack/package.json': JSON.stringify({
          name: 'full-stack',
          dependencies: {
            next: '13.0.0',
            react: '18.0.0',
            express: '4.18.0',
          },
          devDependencies: {
            vite: '4.5.0',
            jest: '29.0.0',
            webpack: '5.0.0',
            vitest: '0.34.0',
          },
        }),
      },
    });

    const result = await getFramework(mockRuntime);

    expect(result).toHaveLength(1);
    const detected = result[0]!;

    // Should detect one framework from each category
    expect(detected.metaFramework?.framework).toBe(Framework.NEXTJS);
    expect(detected.frontendFramework?.framework).toBe(Framework.REACT);
    expect(detected.backendFramework?.framework).toBe(Framework.EXPRESS);
    expect(detected.buildTool?.framework).toBe(Framework.VITE); // Higher confidence than webpack
    expect(detected.testingFramework?.framework).toBe(Framework.VITEST); // Higher confidence than jest
  });
});
