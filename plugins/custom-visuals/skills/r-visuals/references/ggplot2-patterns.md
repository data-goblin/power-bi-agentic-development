# ggplot2 Chart Patterns for Power BI

Common ggplot2 patterns for R visuals. All scripts assume `dataset` is auto-injected as a data.frame. Use index-based access (`dataset[,1]`) to avoid name escaping issues.

## Bar Chart (Vertical)

```r
library(ggplot2)

df <- data.frame(category=dataset[,1], value=dataset[,2])

p <- ggplot(df, aes(x=reorder(category, -value), y=value)) +
  geom_col(fill="#5B8DBE", width=0.7) +
  theme_minimal(base_size=12) +
  theme(
    panel.grid.major.x = element_blank(),
    axis.title = element_blank()
  )

print(p)
```

## Horizontal Bar Chart with Comparison Markers

```r
library(ggplot2)

df <- head(dataset[order(-dataset[,1]),], 8)
df$category <- factor(dataset[seq_len(nrow(df)),2], levels=rev(dataset[seq_len(nrow(df)),2]))

p <- ggplot(df, aes(x=dataset[,1], y=category)) +
  geom_col(fill="#7FA9C7", alpha=0.65, width=0.65) +
  geom_segment(aes(x=dataset[,2], xend=dataset[,2],
    y=as.numeric(category)-0.4, yend=as.numeric(category)+0.4),
    color="#6C757D", size=1.5) +
  geom_text(aes(label=sprintf("%.0f", dataset[,1])),
    hjust=-0.05, size=4, fontface="bold") +
  theme_minimal(base_size=12) +
  theme(panel.grid=element_blank(), axis.title.y=element_blank())

print(p)
```

## Line Chart with Area Fill

```r
library(ggplot2)

month_order <- c("Jan","Feb","Mar","Apr","May","Jun",
                 "Jul","Aug","Sep","Oct","Nov","Dec")
dataset$month_factor <- factor(dataset[,2], levels=month_order)

p <- ggplot(dataset, aes(x=as.numeric(month_factor), y=dataset[,1])) +
  geom_ribbon(aes(ymin=0, ymax=dataset[,1]), fill="#5B8DBE", alpha=0.12) +
  geom_line(color="#5B8DBE", size=1.2) +
  geom_point(color="#5B8DBE", fill="white", size=3, shape=21, stroke=1.5) +
  theme_minimal(base_size=10) +
  theme(panel.grid.minor=element_blank())

print(p)
```

## Donut Chart

```r
library(ggplot2)

color_palette <- c("#5B8DBE","#D4A574","#8BA888","#C97C7C","#9B87B8","#6B9B9E")

dataset$percentage <- dataset[,1] / sum(dataset[,1]) * 100
dataset$ymax <- cumsum(dataset$percentage)
dataset$ymin <- c(0, head(dataset$ymax, n=-1))

p <- ggplot(dataset, aes(ymax=ymax, ymin=ymin, xmax=4, xmin=2.5, fill=dataset[,2])) +
  geom_rect(color="white", size=2.5) +
  coord_polar(theta="y") +
  xlim(c(1, 4.5)) +
  scale_fill_manual(values=color_palette) +
  theme_void() +
  theme(legend.position="bottom")

print(p)
```

## Dual-Series YTD Comparison

```r
library(ggplot2)

data_long <- data.frame(
  month_index = rep(1:nrow(dataset), 2),
  value = c(dataset[,1], dataset[,2]),
  series = rep(c("Current YTD", "PY YTD"), each=nrow(dataset))
)

p <- ggplot(data_long, aes(x=month_index, y=value, color=series, linetype=series)) +
  geom_line(size=1.8) +
  scale_color_manual(values=c("Current YTD"="#5B8DBE", "PY YTD"="#D4A574")) +
  scale_linetype_manual(values=c("Current YTD"="solid", "PY YTD"="dashed")) +
  theme_minimal(base_size=14) +
  theme(legend.position="top", legend.title=element_blank())

print(p)
```

## Bullet Chart with DAX-Driven Colors

```r
library(ggplot2)

df <- data.frame(
  key_account = dataset[,1],
  value = dataset[,2],
  target = dataset[,3],
  bar_color = dataset[,4]  # Color from DAX measure
)

p <- ggplot(df, aes(x=key_account, y=value)) +
  geom_col(aes(fill=bar_color), width=0.6) +
  scale_fill_identity() +
  geom_point(aes(y=target), color="#495057", size=9, shape=124) +
  coord_flip() +
  theme_minimal(base_size=12) +
  theme(panel.grid.major.y=element_blank(), axis.title=element_blank())

print(p)
```

## Correlation Heatmap

```r
library(ggplot2)

# For numeric columns only
num_data <- dataset[sapply(dataset, is.numeric)]
cor_matrix <- cor(num_data, use="complete.obs")
melted <- reshape2::melt(cor_matrix)  # reshape2 available on Service

p <- ggplot(melted, aes(x=Var1, y=Var2, fill=value)) +
  geom_tile(color="white") +
  geom_text(aes(label=sprintf("%.2f", value)), size=3) +
  scale_fill_gradient2(low="#C97C7C", mid="white", high="#5B8DBE", midpoint=0) +
  theme_minimal(base_size=10) +
  theme(axis.text.x=element_text(angle=45, hjust=1), axis.title=element_blank())

print(p)
```

## Box Plot

```r
library(ggplot2)

p <- ggplot(dataset, aes(x=dataset[,1], y=dataset[,2])) +
  geom_boxplot(fill="#5B8DBE", alpha=0.5, outlier.color="#C97C7C") +
  theme_minimal(base_size=12) +
  theme(panel.grid.major.x=element_blank())

print(p)
```

## Faceted Small Multiples

```r
library(ggplot2)

p <- ggplot(dataset, aes(x=dataset[,2], y=dataset[,3])) +
  geom_line(color="#5B8DBE", size=1) +
  facet_wrap(~dataset[,1], scales="free_y", ncol=3) +
  theme_minimal(base_size=10) +
  theme(strip.text=element_text(face="bold"))

print(p)
```

## Empty Data Guard Pattern

Wrap any script with this guard:

```r
if (nrow(dataset) == 0) {
  plot.new()
  text(0.5, 0.5, "No data available", cex=1.5, col="#6C757D")
} else {
  # ... chart code here ...
}
```
