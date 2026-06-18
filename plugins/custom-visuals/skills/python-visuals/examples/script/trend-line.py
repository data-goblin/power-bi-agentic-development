import matplotlib.pyplot as plt

# dataset is auto-injected as a pandas DataFrame
fig, ax = plt.subplots(figsize=(8, 3))
x = range(len(dataset))
y = dataset.iloc[:, 0]

ax.fill_between(x, 0, y, alpha=0.12, color="#5B8DBE")
ax.plot(
    y.values,
    color="#5B8DBE",
    linewidth=2.4,
    marker="o",
    markerfacecolor="white",
    markeredgecolor="#5B8DBE",
    markersize=6,
)

ax.grid(axis="y", alpha=0.3)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
plt.tight_layout()
plt.show()
