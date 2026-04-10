import matplotlib.pyplot as plt

# dataset is auto-injected as a pandas DataFrame
fig, ax = plt.subplots(figsize=(6, 4))
ax.bar(dataset.iloc[:, 0], dataset.iloc[:, 1], color="#5B8DBE")
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.set_title("Sales by Category", fontsize=14, fontweight="bold")
plt.tight_layout()
plt.show()
