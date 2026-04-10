# Icons set in statusline.sh: NerdFonts MDI (nf-md-robot_*), JetBrainsMono NF 3.4.0
# Opus=󱚝 U+F169D  Sonnet=󱜙 U+F1719  Haiku=󱜚 U+F171A
if [ "$ENABLE_MODEL" = "TRUE" ] && [ -n "$model" ]; then
    model_segment="${model_color}${model_icon}  ${model}"
    [ "$ENABLE_EFFORT" = "TRUE" ] && [ -n "$effort_dots" ] && model_segment="${model_segment} ${effort_dots}"
    seg "${model_segment}${R}"
elif [ "$ENABLE_EFFORT" = "TRUE" ] && [ -n "$effort_dots" ]; then
    seg "${model_color}${effort_dots}${R}"
fi
