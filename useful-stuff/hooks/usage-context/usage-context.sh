#!/usr/bin/env bash
f="$HOME/.cache/claude/usage.json"
cat > /dev/null
[ -r "$f" ] || exit 0
age=$(( ($(date +%s) - $(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f")) / 60 ))
jq -r --arg age "$age" '
  def pct: if . == null then "?" else (. | floor | tostring) + "%" end;
  def at: if . == null then "?" else (tonumber | strftime("%a %H:%MZ")) end;
  "Claude plan usage (\($age) min old): 5h \(.five_hour.used_percentage | pct), resets \(.five_hour.resets_at | at); week \(.seven_day.used_percentage | pct), resets \(.seven_day.resets_at | at)"
' "$f" 2>/dev/null
