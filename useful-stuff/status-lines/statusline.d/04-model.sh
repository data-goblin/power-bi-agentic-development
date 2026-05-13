# Icons set in statusline.sh: NerdFonts MDI (nf-md-robot_*), JetBrainsMono NF 3.4.0
# Opus=󱚝 U+F169D  Sonnet=󱜙 U+F1719  Haiku=󱜚 U+F171A
if [ -n "$model" ]; then
    model_segment="${model_color}${model_icon}  ${model}"
    [ -n "$effort_dots" ] && model_segment="${model_segment} ${effort_dots}"
    seg "${model_segment}${R}"
fi
