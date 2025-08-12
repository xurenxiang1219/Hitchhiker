// Minimal ambient type patches to satisfy old TS during DLL build
// Add shims for packages that cause TS2688 or missing types issues.

declare module 'minimatch' {
  const anyExport: any;
  export = anyExport;
}

// You can add more shims here if further TS2688 errors appear, e.g.:
// declare module 'glob';
// declare module 'highlight.js';
