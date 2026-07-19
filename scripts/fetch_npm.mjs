// Real npm monthly downloads per author (mirrors api/_lib/connectors/npm.ts).
import { writeFile } from 'node:fs/promises';
const AUTHORS = ['sindresorhus','antfu','yyx990803','rauchg','shadcn','jaredpalmer','transitive-bullshit','leerob','steipete','mckaywrigley','luisreindlmeier'];
const out = {};
for (const a of AUTHORS) {
  try {
    const s = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent('author:'+a)}&size=20`);
    const d = await s.json();
    const pkgs = (d.objects||[]).map(o=>o.package?.name).filter(Boolean).slice(0,12);
    let total = 0; const named=[];
    for (const p of pkgs) {
      try { const r = await fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(p)}`); if(r.ok){ const j=await r.json(); total+=j.downloads||0; if((j.downloads||0)>1000) named.push([p,j.downloads]); } } catch {}
    }
    out[a] = { pkgs: pkgs.length, downloads: total, top: named.sort((x,y)=>y[1]-x[1]).slice(0,3) };
    console.error(a, 'pkgs', pkgs.length, 'downloads', total.toLocaleString());
  } catch(e){ out[a] = { error: String(e) }; console.error(a,'ERR'); }
}
await writeFile(new URL('./npm_raw.json', import.meta.url), JSON.stringify(out,null,2));
