set -e
cat > add-measure.csx <<'CSX'
var t = Model.Tables["Sales"];
t.AddMeasure("Total Sales", "SUM(Sales[Amount])");
CSX
real=$(getent passwd "$(id -u)" | cut -d: -f6)
managed="$real/.local/share/tabular-editor-cli/te"
if [ "$real" != "$HOME" ] && [ -x "$managed" ]; then
  mkdir -p "$HOME/.local/share/tabular-editor-cli"
  ln -sf "$managed" "$HOME/.local/share/tabular-editor-cli/te"
fi
