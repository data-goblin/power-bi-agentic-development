library(ggplot2)

# dataset is auto-injected as a data.frame
if (nrow(dataset) == 0) {
  plot.new()
  text(0.5, 0.5, "No data available", cex=1.5)
} else {
  p <- ggplot(dataset, aes(x=seq_len(nrow(dataset)), y=dataset[,1])) +
    geom_ribbon(aes(ymin=0, ymax=dataset[,1]), fill="#5B8DBE", alpha=0.12) +
    geom_line(color="#5B8DBE", size=1.2) +
    geom_point(color="#5B8DBE", fill="white", size=3, shape=21, stroke=1.5) +
    theme_minimal(base_size=10) +
    theme(panel.grid.minor=element_blank())

  print(p)
}
