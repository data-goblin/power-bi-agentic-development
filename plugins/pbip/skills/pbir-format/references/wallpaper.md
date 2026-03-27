# Wallpaper (outspace)

The wallpaper is the area behind/around the report canvas. It is controlled by the `outspace` object in page.json.

**Visual Hierarchy (bottom to top):**
1. **outspace** (wallpaper) - Behind everything, shows in margins or through transparent canvas
2. **background** (canvas) - The actual page where visuals sit
3. **visuals** - On top of the canvas

**Location:** `page.json` → `objects` → `outspace`

**IMPORTANT:** This is NOT the same as:
- **background** - The page/canvas background where visuals sit (see page.md)
- **image visual** - An image placed ON the canvas (see visual-types/image.md)

## Properties

### color
**Type:** Color expression (nested structure)
**Description:** The wallpaper background color (shows behind/through the canvas)
**Structure:** `solid.color.expr`

**Accepts:**
- Literal hex: `{"Literal": {"Value": "'#C8C8C8'"}}`
- ThemeDataColor: `{"ThemeDataColor": {"ColorId": 0, "Percent": 0}}`

**Example:**
```json
"color": {
  "solid": {
    "color": {
      "expr": {
        "Literal": {
          "Value": "'#C8C8C8'"
        }
      }
    }
  }
}
```

### transparency
**Type:** Numeric literal with "D" suffix
**Range:** 0-100
- 0 = fully opaque
- 100 = fully transparent

**Example:**
```json
"transparency": {
  "expr": {
    "Literal": {
      "Value": "66D"
    }
  }
}
```

### image
**Type:** Image object with nested structure
**Description:** Background image for the wallpaper
**Structure:** `image.name`, `image.url`, `image.scaling`

**Sub-properties:**
- **name**: Display name (expr.Literal.Value with single quotes)
- **url**: ResourcePackageItem reference to registered image
- **scaling**: Image scaling mode (expr.Literal.Value with single quotes)

**Scaling Values:**
- `'Fit'` - Fit image within wallpaper area (maintain aspect ratio)
- `'Fill'` - Fill wallpaper area (may crop, maintain aspect ratio)
- `'Tile'` - Tile/repeat image across wallpaper
- `'Normal'` - Show image at original size

**Example:**
```json
"image": {
  "image": {
    "name": {
      "expr": {
        "Literal": {
          "Value": "'space_tiles.png'"
        }
      }
    },
    "url": {
      "expr": {
        "ResourcePackageItem": {
          "PackageName": "RegisteredResources",
          "PackageType": 1,
          "ItemName": "space_tiles006469569899665184.png"
        }
      }
    },
    "scaling": {
      "expr": {
        "Literal": {
          "Value": "'Fit'"
        }
      }
    }
  }
}
```

## Complete Example

```json
{
  "objects": {
    "outspace": [
      {
        "properties": {
          "color": {
            "solid": {
              "color": {
                "expr": {
                  "Literal": {
                    "Value": "'#C8C8C8'"
                  }
                }
              }
            }
          },
          "transparency": {
            "expr": {
              "Literal": {
                "Value": "66D"
              }
            }
          },
          "image": {
            "image": {
              "name": {
                "expr": {
                  "Literal": {
                    "Value": "'space_tiles.png'"
                  }
                }
              },
              "url": {
                "expr": {
                  "ResourcePackageItem": {
                    "PackageName": "RegisteredResources",
                    "PackageType": 1,
                    "ItemName": "space_tiles006469569899665184.png"
                  }
                }
              },
              "scaling": {
                "expr": {
                  "Literal": {
                    "Value": "'Fit'"
                  }
                }
              }
            }
          }
        }
      }
    ]
  }
}
```

## Setting a Wallpaper Image

To add an image to the wallpaper, you must:

1. **Add image file to RegisteredResources:**
   ```
   StaticResources/RegisteredResources/image_name_unique_id.png
   ```

2. **Register the image in `definition/report.json`** (not the bare `report.json` at the report root — that is the PBIR-Legacy file):
   ```json
   {
     "resourcePackages": [
       {
         "name": "RegisteredResources",
         "type": "RegisteredResources",
         "items": [
           {
             "name": "image_name_unique_id.png",
             "path": "image_name_unique_id.png",
             "type": "Image"
           }
         ]
       }
     ]
   }
   ```

3. **Reference in page.json outspace:**
   Use the structure shown above with:
   - `name`: User-friendly display name
   - `url.ResourcePackageItem.ItemName`: Must match registered name from step 2
   - `url.ResourcePackageItem.PackageName`: "RegisteredResources"
   - `url.ResourcePackageItem.PackageType`: 1

**Naming Convention:**
- File name: `descriptive_name` + `unique_numeric_id` + `.png`
- Example: `space_tiles006469569899665184.png`
- Display name can be anything: `'space_tiles.png'`, `'My Background'`, etc.

## Common Patterns

### Solid Color Wallpaper (No Image)
```json
"outspace": [
  {
    "properties": {
      "color": {
        "solid": {
          "color": {
            "expr": {
              "Literal": {
                "Value": "'#2C3E50'"
              }
            }
          }
        }
      },
      "transparency": {
        "expr": {
          "Literal": {
            "Value": "0D"
          }
        }
      }
    }
  }
]
```

### Tiled Background Image
```json
"outspace": [
  {
    "properties": {
      "color": {
        "solid": {
          "color": {
            "expr": {
              "Literal": {
                "Value": "'#FFFFFF'"
              }
            }
          }
        }
      },
      "transparency": {
        "expr": {
          "Literal": {
            "Value": "0D"
          }
        }
      },
      "image": {
        "image": {
          "name": {
            "expr": {
              "Literal": {
                "Value": "'Pattern Tile'"
              }
            }
          },
          "url": {
            "expr": {
              "ResourcePackageItem": {
                "PackageName": "RegisteredResources",
                "PackageType": 1,
                "ItemName": "pattern123456789.png"
              }
            }
          },
          "scaling": {
            "expr": {
              "Literal": {
                "Value": "'Tile'"
              }
            }
          }
        }
      }
    }
  }
]
```

### Semi-Transparent Wallpaper with Image
```json
"outspace": [
  {
    "properties": {
      "color": {
        "solid": {
          "color": {
            "expr": {
              "Literal": {
                "Value": "'#000000'"
              }
            }
          }
        }
      },
      "transparency": {
        "expr": {
          "Literal": {
            "Value": "50D"
          }
        }
      },
      "image": {
        "image": {
          "name": {
            "expr": {
              "Literal": {
                "Value": "'Corporate Logo'"
              }
            }
          },
          "url": {
            "expr": {
              "ResourcePackageItem": {
                "PackageName": "RegisteredResources",
                "PackageType": 1,
                "ItemName": "logo987654321.png"
              }
            }
          },
          "scaling": {
            "expr": {
              "Literal": {
                "Value": "'Fill'"
              }
            }
          }
        }
      }
    }
  }
]
```

## Interaction with Canvas Background

The wallpaper (outspace) shows through the canvas (background) based on canvas transparency:

**Canvas opaque (background transparency: 0D):**
- Wallpaper completely hidden behind canvas
- Only visible in margins if canvas doesn't fill entire page

**Canvas transparent (background transparency: 100D):**
- Wallpaper fully visible through canvas
- Wallpaper color/image shows behind all visuals

**Canvas semi-transparent (background transparency: 50D):**
- Blended view of canvas and wallpaper
- Wallpaper partially visible through canvas

**Example combining both:**
```json
{
  "objects": {
    "background": [
      {
        "properties": {
          "color": {
            "solid": {
              "color": {
                "expr": {
                  "Literal": {
                    "Value": "'#FFFFFF'"
                  }
                }
              }
            }
          },
          "transparency": {
            "expr": {
              "Literal": {
                "Value": "80D"
              }
            }
          }
        }
      }
    ],
    "outspace": [
      {
        "properties": {
          "color": {
            "solid": {
              "color": {
                "expr": {
                  "Literal": {
                    "Value": "'#2C3E50'"
                  }
                }
              }
            }
          },
          "transparency": {
            "expr": {
              "Literal": {
                "Value": "0D"
              }
            }
          },
          "image": {
            "image": {
              "name": {
                "expr": {
                  "Literal": {
                    "Value": "'Background Pattern'"
                  }
                }
              },
              "url": {
                "expr": {
                  "ResourcePackageItem": {
                    "PackageName": "RegisteredResources",
                    "PackageType": 1,
                    "ItemName": "pattern123456789.png"
                  }
                }
              },
              "scaling": {
                "expr": {
                  "Literal": {
                    "Value": "'Tile'"
                  }
                }
              }
            }
          }
        }
      }
    ]
  }
}
```

Result: Dark blue wallpaper with tiled pattern shows through 80% transparent white canvas.

## Key Learnings

1. **outspace = wallpaper** - Behind/around the canvas area
2. **background = canvas** - Where visuals sit (separate object)
3. **Image must be registered** - Add to RegisteredResources and register in report.json
4. **PackageType: 1** - Always use 1 for RegisteredResources
5. **Scaling quoted strings** - `'Fit'`, `'Fill'`, `'Tile'`, `'Normal'` (with single quotes)
6. **Name vs ItemName** - name is display name, ItemName is file name
7. **Color + Image** - Both can be set; color shows when no image or through image transparency
8. **Transparency suffix** - Use "D" suffix: `"66D"`, `"0D"`

## Related Documentation

- [page.md](./page.md) - Page structure and background (canvas) object
- [visual-container-formatting.md](./visual-container-formatting.md) - Visual container formatting
