# group (Group)

A visual group container that wraps multiple visuals so they can be moved, sized, and layered together as a single unit.

## Containers

| Container | Key Properties |
|-----------|---------------|
| `background` | `show`, `color`, `transparency` |
| `general` | `altText`, `x`, `y`, `width`, `height` |
| `lockAspect` | `show` |

## Theme Example

```json
{
  "name": "My Theme",
  "visualStyles": {
    "group": {
      "*": {
        "background": [{ "show": false }],
        "lockAspect": [{ "show": false }]
      }
    }
  }
}
```

## Notes

- `group` has only three containers; it has no `title`, `border`, `dropShadow`, or `visualHeader`.
- `general` properties (`x`, `y`, `width`, `height`) are positional and stored per-visual — they are not meaningful at theme level.
- Group background is transparent by default; enabling it is useful to give a panel of visuals a shared fill color.
