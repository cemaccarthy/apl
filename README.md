# APL Studio — a Dyalog APL workbench for iPad

Static PWA. Editor + files + glyph keyboard run fully offline; code execution is
proxied to Dyalog's free TryAPL interpreter (network required). Unofficial —
not affiliated with Dyalog Ltd.

## Deploy to GitHub Pages
1. Create a repo, push these files **keeping the folder structure**
   (`css/`, `js/` at the repo root).
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Open `https://<user>.github.io/<repo>/`.

## Add to iPad home screen
Share button → **Add to Home Screen**. It launches full-screen (standalone).
For a crisp icon, convert `icon.svg` to `icon-180.png` (any SVG→PNG tool) —
iOS ignores the manifest icon without it.

## Notes
- Execution defaults to `https://tryapl.org/api/exec`. If CORS ever blocks it
  from your host, deploy this 10-line proxy and paste its URL into
  Settings → Endpoint:

      export default { async fetch(req) {
        const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type'};
        if (req.method === 'OPTIONS') return new Response(null, {headers: cors});
        const res = await fetch('https://tryapl.org/api/exec', req);
        const h = new Headers(res.headers); h.set('Access-Control-Allow-Origin','*');
        return new Response(res.body, {status: res.status, headers: h});
      }}

- Each **Run** is a fresh request — select dependent lines together.
- Files live in `localStorage`; use *Export workspace* as a backup.
- Keyboard rows are plain arrays at the top of `js/app.js` — reorder to taste.
- After changing code, bump `CACHE` in `sw.js` so installed clients refresh.
