# ChipScribe

**Free in-browser IEEE-style block diagram editor for analog, RF & mixed-signal ICs.**

**Live: <https://web.mit.edu/sanjayc/chipscribe>**

Open `index.html` in any browser (or use the live link) and draw publication-ready block
diagrams in the ISSCC/JSSC figure idiom: circuit stamps (amps, mixers, filters, DACs/ADCs,
passives with real terminals), glued connector wiring that re-routes when blocks move,
undo/redo, align/distribute, and SVG/PNG/layout-JSON export.

## Repo layout

| Path | What it is |
|---|---|
| `index.html` | The complete app, ready to serve anywhere |
| `src/build.py` | Generator — assembles `index.html` from the template, editor runtime, and the demo figure |
| `src/page_template.html` | Page shell (toolbar, styles) |
| `src/editor_app.js` | Editor runtime (drag, draw, stamps, terminal-snapping connectors) |
| `tests/` | Test-harness generators (run under `jsc` or `node`) |

## Building

```bash
cd src && python3 build.py     # regenerates ../index.html
```

## Testing

```bash
cd tests && python3 mk_conn_test.py  && jsc conn_test.js    # routing engine (460+ cases)
cd tests && python3 mk_smoke_test.py && jsc smoke_test.js   # startup smoke test (stub DOM)
```

(`jsc` ships with macOS at
`/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`;
`node` works identically.)
