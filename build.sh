#!/bin/sh
set -e
OUT=index.html

{ cat src/00_head.html; echo '<script>'; for f in src/10_engine.js src/20_io.js src/30_db.js src/35_cloud.js src/37_native.js src/40_demo.js src/50_ui_core.js src/55_gate.js src/60_views_a.js src/61_views_b.js src/62_views_c.js src/63_reports.js; do cat "$f"; echo; done; echo '</script>'; echo '</body></html>'; } > $OUT
echo built $(wc -c < $OUT) bytes
