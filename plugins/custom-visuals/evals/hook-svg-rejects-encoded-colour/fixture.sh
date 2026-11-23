set -e
cat > measures.dax <<'DAX'
Revenue Bar =
"data:image/svg+xml;utf8," &
"<svg xmlns='http://www.w3.org/2000/svg' width='100' height='20'>" &
"<rect width='100' height='20' fill='#eeeeee'/>" &
"<rect width='60' height='20' fill='#2a7de1'/>" &
"</svg>"
DAX
