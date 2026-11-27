import { setFlagsFromString } from 'node:v8';
setFlagsFromString('--no-incremental-marking');
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const { run } = await import('./solve.js');

// The harness mounts the cases at /input/cases.json and collects the
// answers at /output/answers.json. MAKEFUN_INPUT / MAKEFUN_OUTPUT only
// override those paths for local runs; the defaults are the spec paths.
const inputPath = process.env.MAKEFUN_INPUT ?? '/input/cases.json';
const outputPath = process.env.MAKEFUN_OUTPUT ?? '/output/answers.json';

const cases = JSON.parse(readFileSync(inputPath, 'utf8')) as Array<{
  id: string;
  input: { old: string; new: string };
}>;

const answers: string[] = new Array(cases.length);
for (let i = 0; i < cases.length; i++) {
  answers[i] = run(cases[i].input);
}

const slash = outputPath.lastIndexOf('/');
if (slash > 0) mkdirSync(outputPath.slice(0, slash), { recursive: true });
writeFileSync(outputPath, JSON.stringify(answers));
