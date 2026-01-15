#!/bin/bash
# Update local TabularEditorDocs repository

DOCS_DIR="/Users/klonk/Desktop/Git/TabularEditorDocs"

if [ ! -d "$DOCS_DIR" ]; then
    echo "Error: TabularEditorDocs not found at $DOCS_DIR"
    echo "Clone it with: git clone https://github.com/TabularEditor/TabularEditorDocs.git $DOCS_DIR"
    exit 1
fi

cd "$DOCS_DIR" || exit 1

echo "Updating TabularEditorDocs..."
git fetch origin
git pull origin main

echo "Done. Current commit:"
git log -1 --oneline
