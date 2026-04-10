# Python Chart Patterns for Power BI

Common matplotlib/seaborn patterns for Python visuals. All scripts assume `dataset` is auto-injected as a pandas DataFrame.

## Bar Chart

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 4))
ax.bar(dataset["Category"], dataset["Value"], color="#5B8DBE")
ax.set_title("Sales by Category", fontsize=14, fontweight="bold")
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
plt.tight_layout()
plt.show()
```

## Horizontal Bar Chart with Comparison

```python
import matplotlib.pyplot as plt

df = dataset.sort_values(dataset.columns[1], ascending=True).tail(8)

fig, ax = plt.subplots(figsize=(8, 5))
ax.barh(df.iloc[:,0], df.iloc[:,1], color="#7FA9C7", alpha=0.65, height=0.6)

# PY comparison markers
ax.scatter(df.iloc[:,2], df.iloc[:,0], color="#6C757D", marker="|", s=200, linewidths=2, zorder=3)

# Value labels
for i, (v, name) in enumerate(zip(df.iloc[:,1], df.iloc[:,0])):
    ax.text(v + 0.5, i, f"{v:,.0f}", va="center", fontsize=10, fontweight="bold")

ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.set_xlabel("")
plt.tight_layout()
plt.show()
```

## Line Chart with Area Fill

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 3))
x = range(len(dataset))
y = dataset.iloc[:,0]

ax.fill_between(x, 0, y, alpha=0.12, color="#5B8DBE")
ax.plot(y.values, color="#5B8DBE", linewidth=2.4,
        marker="o", markerfacecolor="white", markeredgecolor="#5B8DBE", markersize=6)

ax.grid(axis="y", alpha=0.3)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
plt.tight_layout()
plt.show()
```

## Seaborn Heatmap

```python
import matplotlib.pyplot as plt
import seaborn as sns

pivot = dataset.pivot_table(values=dataset.columns[2],
                            index=dataset.columns[0],
                            columns=dataset.columns[1])

fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(pivot, annot=True, fmt=".0f", cmap="Blues", ax=ax,
            linewidths=0.5, linecolor="white")
plt.tight_layout()
plt.show()
```

## Donut Chart

```python
import matplotlib.pyplot as plt

colors = ["#5B8DBE", "#D4A574", "#8BA888", "#C97C7C", "#9B87B8", "#6B9B9E"]

fig, ax = plt.subplots(figsize=(5, 4))
wedges, texts = ax.pie(
    dataset.iloc[:,1],
    labels=dataset.iloc[:,0],
    colors=colors[:len(dataset)],
    startangle=90,
    wedgeprops={"width": 0.4, "edgecolor": "white", "linewidth": 3}
)
ax.axis("equal")
plt.tight_layout()
plt.show()
```

## KPI Card (Text Only)

```python
import matplotlib.pyplot as plt

value = dataset.iloc[:,0].sum()

fig, ax = plt.subplots(figsize=(3, 2))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")
ax.text(0.5, 0.7, "Revenue", ha="center", fontsize=10, color="#6C757D",
        fontfamily="Segoe UI")
ax.text(0.5, 0.4, f"${value:,.0f}", ha="center", fontsize=24,
        fontweight="bold", fontfamily="Segoe UI")
plt.tight_layout(pad=0)
plt.show()
```

## Scatter Plot with Regression

```python
import matplotlib.pyplot as plt
import numpy as np

x = dataset.iloc[:,0].values
y = dataset.iloc[:,1].values

fig, ax = plt.subplots(figsize=(6, 5))
ax.scatter(x, y, color="#5B8DBE", alpha=0.6, s=50)

# Trend line
z = np.polyfit(x, y, 1)
p = np.poly1d(z)
ax.plot(sorted(x), p(sorted(x)), "--", color="#C97C7C", linewidth=1.5)

ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.set_xlabel(dataset.columns[0], fontsize=11)
ax.set_ylabel(dataset.columns[1], fontsize=11)
plt.tight_layout()
plt.show()
```

## Histogram with KDE

```python
import matplotlib.pyplot as plt
import seaborn as sns

fig, ax = plt.subplots(figsize=(7, 4))
sns.histplot(dataset.iloc[:,0], kde=True, color="#5B8DBE", ax=ax, bins=20)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
plt.tight_layout()
plt.show()
```

## Box Plot

```python
import matplotlib.pyplot as plt
import seaborn as sns

fig, ax = plt.subplots(figsize=(8, 4))
sns.boxplot(data=dataset, x=dataset.columns[0], y=dataset.columns[1],
            palette="Blues", ax=ax)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
plt.tight_layout()
plt.show()
```

## Color Palette Constants

Define at the top of any script to match report themes:

```python
# Muted palette (works well with Power BI)
COLORS = ["#5B8DBE", "#D4A574", "#8BA888", "#C97C7C", "#9B87B8", "#6B9B9E"]

# Sentiment colors
COLOR_POSITIVE = "#4CAF50"
COLOR_NEGATIVE = "#F44336"
COLOR_NEUTRAL = "#9E9E9E"

# Sequential
CMAP = "Blues"  # seaborn/matplotlib colormap
```
