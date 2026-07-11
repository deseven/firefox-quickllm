#!/usr/bin/env node
// Type-check gate for the QuickLLM build.
//
// esbuild strips types but does not type-check, so this script runs
// `tsc --noEmit` against jsconfig.json and fails (exit 1) if there are any
// type errors in the project's own source files (src/**).
//
// Errors originating in node_modules/ are third-party and are intentionally
// ignored — they are outside the project's control and not part of the
// codebase we maintain.

const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const tscBin = path.join(projectRoot, 'node_modules', '.bin', 'tsc');

let output;
try {
    // tsc exits non-zero when it finds errors; capture the combined output.
    execSync(`"${tscBin}" --noEmit -p "${path.join(projectRoot, 'jsconfig.json')}"`, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
    });
    output = '';
} catch (error) {
    output = (error.stdout || '') + (error.stderr || '');
}

// Only surface errors in our own source files.
const srcErrors = output
    .split('\n')
    .filter((line) => line.startsWith('src/') || line.includes(')src/') || /\bsrc\//.test(line));

if (srcErrors.length > 0) {
    console.error('\n❌ Type check failed — errors in src/:\n');
    console.error(srcErrors.join('\n'));
    console.error(`\n${srcErrors.length} type error(s) in src/. Fix them before building.`);
    process.exit(1);
}

console.log('✓ Type check passed (no errors in src/).');
