library(ggplot2)

# dataset is auto-injected as a data.frame
if (nrow(dataset) == 0) {
  plot.new()
  text(0.5, 0.5, "No data available", cex=1.5)
} else {
  df <- data.frame(category=dataset[,1], value=dataset[,2])

  p <- ggplot(df, aes(x=reorder(category, -value), y=value)) +
    geom_col(fill="#5B8DBE", width=0.7) +
    theme_minimal(base_size=12) +
    theme(
      panel.grid.major.x = element_blank(),
      axis.title = element_blank()
    )

  print(p)
}
