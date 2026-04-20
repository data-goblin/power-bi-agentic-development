# pbi-search

[`pbi-search`](https://github.com/data-goblin/pbi-search) is a documentation search CLI for Power BI, Tabular Editor, DAX, and Fabric. The `te-docs` skill depends on it for documentation search.

## Install

### From source (recommended)

Requires [Rust](https://rustup.rs/):

```bash
cargo install --git https://github.com/data-goblin/pbi-search
pbi-search sync
```

### From GitHub Releases

Download the binary for your platform from the [pbi-search releases page](https://github.com/data-goblin/pbi-search/releases), place it on your `PATH`, then run:

```bash
pbi-search sync
```

## First run

After installing, populate the local manifest cache:

```bash
pbi-search sync        # ~13s
```

For richer search results (optional):

```bash
pbi-search sync --descriptions   # ~30s extra
```
