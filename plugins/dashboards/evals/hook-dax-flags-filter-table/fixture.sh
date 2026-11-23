set -e
mkdir -p queries
cat > queries/revenue.dax <<'DAX'
EVALUATE
SUMMARIZECOLUMNS(
    'Product'[Category],
    "Revenue", [Total Revenue]
)
DAX
