// solve.js
//
// Line diff compatible with makefun-diff 1.0.0, written from scratch from
// the competition spec (RULES.txt). No dependencies. ES module.
//
// run(input) takes { old, new } (two texts) and returns the makefun-diff
// patch as one string:
//
//   makefun-diff/1 old=N new=M hunks=H deleted=D inserted=I
//   @ os ol ns nl
//   = kept line / - deleted line / + inserted line   (per hunk)
//
// Rules implemented:
// - A text is cut after every '\n', the only separator; a '\r' is part of
//   its line, and a last line with no '\n' is a line too. Two lines are
//   equal only when they are the same code units, newline included.
// - The common prefix of lines is kept, then the common suffix of the
//   lines left; between them a forward greedy Myers search runs from the
//   first lines. On each diagonal it keeps the path reaching furthest
//   into the old text; when a deletion and an insertion reach the same
//   point the deletion wins; it never moves past either text's end and
//   follows every run of equal lines as far as it goes. The first path
//   to reach both ends is the script.
// - Each run of changes lists its deletions before its insertions and
//   shows up to 3 kept lines before and after it; two runs at most 6
//   kept lines apart share a hunk.
// - A line that ends its text with no newline is written with one and
//   followed by a line '%'. Identical texts are the first line alone.
//
// Speed: lines are interned to integer ids (comparisons are integer
// compares), Myers runs on Int32Array views with its V history in one
// flat triangular Int32Array, and no per-line objects are allocated.

export function run(input) {
  const oldText = input && typeof input.old === 'string' ? input.old : '';
  const newText = input && typeof input.new === 'string' ? input.new : '';

  // ---- Split into lines and intern them to integer ids. ----
  const intern = new Map();
  const oldLines = [];
  const newLines = [];
  const oldIds = [];
  const newIds = [];

  function split(text, lines, ids) {
    let start = 0;
    const len = text.length;
    while (start < len) {
      const nl = text.indexOf('\n', start);
      let line;
      if (nl === -1) {
        line = text.slice(start);
        start = len;
      } else {
        line = text.slice(start, nl + 1);
        start = nl + 1;
      }
      lines.push(line);
      let id = intern.get(line);
      if (id === undefined) {
        id = intern.size;
        intern.set(line, id);
      }
      ids.push(id);
    }
  }
  split(oldText, oldLines, oldIds);
  split(newText, newLines, newIds);

  const a = Int32Array.from(oldIds);
  const b = Int32Array.from(newIds);
  const N = a.length;
  const M = b.length;

  // ---- Common prefix, then common suffix of what is left. ----
  let p = 0;
  const minNM = N < M ? N : M;
  while (p < minNM && a[p] === b[p]) p++;
  let s = 0;
  while (s < N - p && s < M - p && a[N - 1 - s] === b[M - 1 - s]) s++;
  const n = N - p - s;
  const m = M - p - s;
  // Middle views (line ids only; the strings stay in oldLines/newLines).
  const A = a.subarray(p, p + n);
  const B = b.subarray(p, p + m);

  // ---- Forward greedy Myers over the middle. ----
  // V history in one flat triangular array: level d occupies
  // off(d) .. off(d) + d, off(d) = d * (d + 1) / 2; entry t (0..d) is
  // diagonal k = -d + 2t and holds the furthest x reached there.
  // Move choice: insertion (down, from diagonal k+1) only when
  // V[k-1] + 1 < V[k+1]; otherwise deletion (right, from k-1). On a tie
  // (both moves reach the same point) the deletion wins.
  const off = (d) => (d * (d + 1)) / 2;
  let capD = 512;
  let V = new Int32Array(((capD + 1) * (capD + 2)) / 2);

  let D = 0;
  let endT = 0;
  let done = false;
  {
    // d = 0: pure snake from the start.
    let x = 0;
    let y = 0;
    while (x < n && y < m && A[x] === B[y]) {
      x++;
      y++;
    }
    V[0] = x;
    if (x >= n && y >= m) {
      D = 0;
      endT = 0;
      done = true;
    }
  }
  for (let d = 1; d <= n + m && !done; d++) {
    if (d > capD) {
      const ncap = capD * 2;
      const NV = new Int32Array(((ncap + 1) * (ncap + 2)) / 2);
      NV.set(V);
      V = NV;
      capD = ncap;
    }
    const basePrev = off(d - 1);
    const baseCur = off(d);
    for (let t = 0; t <= d; t++) {
      const k = -d + 2 * t;
      let x;
      if (t === 0) {
        // k == -d: only the insertion is possible.
        x = V[basePrev];
      } else if (t === d) {
        // k == d: only the deletion is possible.
        x = V[basePrev + t - 1] + 1;
      } else {
        const va = V[basePrev + t - 1];
        const vb = V[basePrev + t];
        x = va + 1 < vb ? vb : va + 1;
      }
      let y = x - k;
      while (x < n && y < m && A[x] === B[y]) {
        x++;
        y++;
      }
      V[baseCur + t] = x;
      if (x >= n && y >= m) {
        D = d;
        endT = t;
        done = true;
        break;
      }
    }
  }
  if (!done) throw new Error('myers: no path found');

  // ---- Backtrack into an op list (0 = keep, 1 = delete, 2 = insert). ----
  // Filled from the end, so the finished array reads in forward order.
  const keepsMid = (n + m - D) / 2;
  const totalOps = p + s + keepsMid + D;
  const ops = new Int8Array(totalOps);
  let pos = totalOps;
  for (let i = 0; i < s; i++) ops[--pos] = 0; // suffix keeps
  {
    let x = V[off(D) + endT];
    let y = x - (-D + 2 * endT);
    for (let d = D; d >= 1; d--) {
      const k = x - y;
      const t = (k + d) / 2;
      const basePrev = off(d - 1);
      let insertion;
      let prevT;
      if (k === -d) {
        insertion = true;
        prevT = t;
      } else if (k === d) {
        insertion = false;
        prevT = t - 1;
      } else {
        const va = V[basePrev + t - 1];
        const vb = V[basePrev + t];
        if (va + 1 < vb) {
          insertion = true;
          prevT = t;
        } else {
          insertion = false;
          prevT = t - 1;
        }
      }
      const prevX = V[basePrev + prevT];
      const prevK = insertion ? k + 1 : k - 1;
      const prevY = prevX - prevK;
      const px = insertion ? prevX : prevX + 1;
      const py = insertion ? prevY + 1 : prevY;
      while (x > px && y > py) {
        ops[--pos] = 0;
        x--;
        y--;
      }
      if (insertion) {
        ops[--pos] = 2;
        y--;
      } else {
        ops[--pos] = 1;
        x--;
      }
      x = prevX;
      y = prevY;
    }
    while (x > 0) {
      ops[--pos] = 0;
      x--;
      y--;
    }
  }
  for (let i = 0; i < p; i++) ops[--pos] = 0; // prefix keeps

  // ---- Old/new line index before each op, plus delete/insert totals. ----
  const oldPos = new Int32Array(totalOps + 1);
  const newPos = new Int32Array(totalOps + 1);
  let oi = 0;
  let ni = 0;
  let deleted = 0;
  let inserted = 0;
  for (let i = 0; i < totalOps; i++) {
    oldPos[i] = oi;
    newPos[i] = ni;
    const op = ops[i];
    if (op === 0) {
      oi++;
      ni++;
    } else if (op === 1) {
      oi++;
      deleted++;
    } else {
      ni++;
      inserted++;
    }
  }
  oldPos[totalOps] = oi;
  newPos[totalOps] = ni;

  // ---- Change runs, merged into hunks (at most 6 kept lines apart). ----
  const runs = [];
  let i = 0;
  while (i < totalOps) {
    if (ops[i] === 0) {
      i++;
      continue;
    }
    const start = i;
    while (i < totalOps && ops[i] !== 0) i++;
    runs.push([start, i]);
  }
  // hunks hold [firstRunStart, lastRunEnd] in op indices.
  const hunks = [];
  for (const r of runs) {
    if (hunks.length > 0) {
      const last = hunks[hunks.length - 1];
      if (r[0] - last[1] <= 6) {
        last[1] = r[1];
        continue;
      }
    }
    hunks.push([r[0], r[1]]);
  }

  // ---- Render the patch. ----
  const parts = [];
  parts.push(
    `makefun-diff/1 old=${N} new=${M} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`,
  );
  for (const h of hunks) {
    const os0 = h[0] - 3 > 0 ? h[0] - 3 : 0;
    const oe0 = h[1] + 3 < totalOps ? h[1] + 3 : totalOps;
    parts.push(
      `@ ${oldPos[os0] + 1} ${oldPos[oe0] - oldPos[os0]} ${newPos[os0] + 1} ${newPos[oe0] - newPos[os0]}\n`,
    );
    let j = os0;
    let o = oldPos[os0];
    let w = newPos[os0];
    while (j < oe0) {
      if (ops[j] === 0) {
        emitLine(parts, '=', oldLines[o]);
        o++;
        w++;
        j++;
      } else {
        // One run of changes: deletions first, then insertions.
        let k = j;
        let dc = 0;
        let ic = 0;
        while (k < oe0 && ops[k] !== 0) {
          if (ops[k] === 1) dc++;
          else ic++;
          k++;
        }
        for (let q = 0; q < dc; q++) {
          emitLine(parts, '-', oldLines[o]);
          o++;
        }
        for (let q = 0; q < ic; q++) {
          emitLine(parts, '+', newLines[w]);
          w++;
        }
        j = k;
      }
    }
  }
  return parts.join('');
}

// Write one patch line: the prefix plus the line itself. A line that ends
// its text with no newline is written with one and followed by a '%' line.
// (Only a text's last line can lack its newline, so the check is enough.)
function emitLine(parts, prefix, line) {
  parts.push(prefix, line);
  const last = line.length - 1;
  if (last < 0 || line.charCodeAt(last) !== 10) parts.push('\n%\n');
}
