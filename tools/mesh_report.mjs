// Mesh watertightness report for a .glb (JIM-10).
//
// Counts BOUNDARY edges — edges used by exactly one triangle. A sealed mesh
// has none; every one is a hole you can see through, and since Jimothy's
// material is DoubleSide each hole shows the dark inside of his own shell.
//
// Vertices must be welded by POSITION first: glTF splits them per-face for
// normals and UVs, so raw indices make even a perfect mesh look like loose
// triangles.
//
//   node tools/mesh_report.mjs public/assets/models/jimothy-rig.glb
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/mesh_report.mjs <file.glb>');
  process.exit(1);
}

const buf = fs.readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const bin = buf.slice(20 + jsonLen + 8);

const where = (i) => {
  const a = json.accessors[i];
  const bv = json.bufferViews[a.bufferView];
  if (bv.byteStride && bv.byteStride !== 12 && a.type === 'VEC3') {
    throw new Error('interleaved buffer — this reader assumes tight packing');
  }
  return { a, off: (bv.byteOffset || 0) + (a.byteOffset || 0) };
};

const indicesOf = (i) => {
  const { a, off } = where(i);
  const out = new Array(a.count);
  for (let k = 0; k < a.count; k++) {
    out[k] = a.componentType === 5125 ? bin.readUInt32LE(off + k * 4)
      : a.componentType === 5123 ? bin.readUInt16LE(off + k * 2)
        : bin.readUInt8(off + k);
  }
  return out;
};

const positionsOf = (i) => {
  const { a, off } = where(i);
  const out = new Array(a.count);
  for (let k = 0; k < a.count; k++) {
    out[k] = [
      bin.readFloatLE(off + k * 12),
      bin.readFloatLE(off + k * 12 + 4),
      bin.readFloatLE(off + k * 12 + 8),
    ];
  }
  return out;
};

let totalTris = 0;
let totalBoundary = 0;
const rows = [];

for (const mesh of json.meshes) {
  for (const prim of mesh.primitives) {
    const idx = indicesOf(prim.indices);
    const pos = positionsOf(prim.attributes.POSITION);
    // 1e-5 is far below any real feature size here and far above float noise.
    const key = (v) => `${Math.round(v[0] * 1e5)},${Math.round(v[1] * 1e5)},${Math.round(v[2] * 1e5)}`;
    const canon = new Map();
    const vid = pos.map((v) => {
      const k = key(v);
      if (!canon.has(k)) canon.set(k, canon.size);
      return canon.get(k);
    });

    const edges = new Map();
    for (let i = 0; i < idx.length; i += 3) {
      const t = [vid[idx[i]], vid[idx[i + 1]], vid[idx[i + 2]]];
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const k = t[a] < t[b] ? `${t[a]}_${t[b]}` : `${t[b]}_${t[a]}`;
        edges.set(k, (edges.get(k) || 0) + 1);
      }
    }
    let boundary = 0;
    let nonManifold = 0;
    for (const n of edges.values()) {
      if (n === 1) boundary++;
      else if (n > 2) nonManifold++;
    }
    const tris = idx.length / 3;
    totalTris += tris;
    totalBoundary += boundary;
    rows.push({
      name: mesh.name || `mesh${rows.length}`,
      tris,
      verts: canon.size,
      edges: edges.size,
      boundary,
      nonManifold,
      sealed: boundary === 0,
    });
  }
}

const pad = (s, n) => String(s).padStart(n);
console.log(`\n${file}`);
console.log('piece      tris    welded    edges  boundary   open%  non-manifold  status');
for (const r of rows) {
  const pct = ((r.boundary / Math.max(1, r.edges)) * 100).toFixed(1);
  console.log(
    `${r.name.padEnd(9)} ${pad(r.tris, 6)} ${pad(r.verts, 8)} ${pad(r.edges, 8)} `
    + `${pad(r.boundary, 9)} ${pad(pct, 6)}  ${pad(r.nonManifold, 12)}  ${r.sealed ? 'sealed' : 'OPEN'}`,
  );
}
console.log(`\ntotal: ${totalTris} tris, ${totalBoundary} boundary edges`);
