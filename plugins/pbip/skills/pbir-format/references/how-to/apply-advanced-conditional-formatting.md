# How To: Apply Advanced Conditional Formatting

Step-by-step guide for applying complex conditional formatting to bar charts, column charts, and other visuals.

## Prerequisites

1. Report downloaded in PBIP format
2. Extension measures created in `reportExtensions.json`
3. Visual already created on a page

## Scenario 1: Color Bars Based on Measure Value

**Goal:** Color each bar based on the value of a measure (e.g., red for low, green for high)

### Step 1: Create the Extension Measure

Edit `reportExtensions.json`:

```json
{
  "name": "Bar Color",
  "dataType": "Text",
  "description": "Returns color based on Order Lines value",
  "expression": "\nVAR _Value = [Order Lines]\nRETURN\n    SWITCH(\n        TRUE(),\n        _Value < 10, \"bad\",\n        _Value < 50, \"neutral\",\n        \"good\"\n    )",
  "references": {
    "measures": [
      {
        "entity": "Orders",
        "name": "Order Lines"
      }
    ]
  }
}
```

### Step 2: Edit the Visual JSON

Open `definition/pages/<page-id>/visuals/<visual-id>/visual.json`

Add or update the `objects.dataPoint` array:

```json
{
  "visual": {
    "visualType": "clusteredBarChart",
    "query": { /* existing query */ },
    "objects": {
      "dataPoint": [
        {
          "properties": {
            "fill": {
              "solid": {
                "color": {
                  "expr": {
                    "Measure": {
                      "Expression": {
                        "SourceRef": {
                          "Schema": "extension",
                          "Entity": "Orders"
                        }
                      },
                      "Property": "Bar Color"
                    }
                  }
                }
              }
            }
          },
          "selector": {
            "data": [
              {
                "dataViewWildcard": {
                  "matchingOption": 1
                }
              }
            ]
          }
        }
      ]
    }
  }
}
```

### Step 3: Deploy and Verify

```bash
fab import "Workspace.Workspace/Report.Report" -i ./Report.Report -f
```

## Scenario 2: Add Dynamic Data Labels

**Goal:** Show custom text in data labels with measure-driven content

### Step 1: Create Content Measures

Edit `reportExtensions.json`:

```json
{
  "name": "Label Title",
  "dataType": "Text",
  "description": "Custom label title text",
  "expression": "\nVAR Account = SELECTEDVALUE(Customers[Key Account Name])\nVAR Value = [Order Lines]\nRETURN\n    Account & \" (\" & FORMAT(Value, \"#,0\") & \")\"",
  "references": {
    "columns": [
      {
        "entity": "Customers",
        "name": "Key Account Name"
      }
    ],
    "measures": [
      {
        "entity": "Orders",
        "name": "Order Lines"
      }
    ]
  }
}
```

### Step 2: Configure Label Properties

In `visual.json`, add to `objects.labels` array:

```json
{
  "objects": {
    "labels": [
      {
        "properties": {
          "enableTitleDataLabel": {
            "expr": {"Literal": {"Value": "true"}}
          },
          "titleContentType": {
            "expr": {"Literal": {"Value": "'Custom'"}}
          },
          "enableDetailDataLabel": {
            "expr": {"Literal": {"Value": "true"}}
          },
          "enableBackground": {
            "expr": {"Literal": {"Value": "true"}}
          }
        }
      }
    ]
  }
}
```

### Step 3: Add Dynamic Content

Add second entry to `objects.labels` array:

```json
{
  "properties": {
    "dynamicLabelTitle": {
      "expr": {
        "Measure": {
          "Expression": {
            "SourceRef": {
              "Schema": "extension",
              "Entity": "Customers"
            }
          },
          "Property": "Label Title"
        }
      }
    },
    "dynamicLabelDetail": {
      "expr": {
        "Measure": {
          "Expression": {
            "SourceRef": {
              "Entity": "Invoices"
            }
          },
          "Property": "Invoice Lines"
        }
      }
    }
  },
  "selector": {
    "data": [
      {
        "dataViewWildcard": {
          "matchingOption": 1
        }
      }
    ],
    "highlightMatching": 1
  }
}
```

## Scenario 3: Color Data Labels

**Goal:** Apply measure-based colors to data label text

### Step 1: Use Existing Color Measure

Reuse the color measure from Scenario 1 or create a new one.

### Step 2: Add Label Color Formatting

Add third entry to `objects.labels` array:

```json
{
  "properties": {
    "titleColor": {
      "solid": {
        "color": {
          "expr": {
            "Measure": {
              "Expression": {
                "SourceRef": {
                  "Schema": "extension",
                  "Entity": "Orders"
                }
              },
              "Property": "Bar Color"
            }
          }
        }
      }
    },
    "color": {
      "solid": {
        "color": {
          "expr": {
            "Measure": {
              "Expression": {
                "SourceRef": {
                  "Schema": "extension",
                  "Entity": "Orders"
                }
              },
              "Property": "Bar Color"
            }
          }
        }
      }
    }
  },
  "selector": {
    "data": [
      {
        "dataViewWildcard": {
          "matchingOption": 1
        }
      }
    ]
  }
}
```

**Properties:**
- `titleColor` - Title line text color
- `color` - Label background color
- `detailColor` - Detail line text color (see below for gradient)

## Scenario 4: Gradient-Based Label Detail Color

**Goal:** Apply gradient coloring to detail line based on measure value

### Step 1: Add Gradient Configuration

In the third `labels` entry, add `detailColor`:

```json
{
  "properties": {
    "detailColor": {
      "solid": {
        "color": {
          "expr": {
            "FillRule": {
              "Input": {
                "Measure": {
                  "Expression": {
                    "SourceRef": {
                      "Entity": "Invoices"
                    }
                  },
                  "Property": "Invoice Lines"
                }
              },
              "FillRule": {
                "linearGradient2": {
                  "min": {
                    "color": {
                      "Literal": {
                        "Value": "'minColor'"
                      }
                    }
                  },
                  "max": {
                    "color": {
                      "Literal": {
                        "Value": "'maxColor'"
                      }
                    }
                  },
                  "nullColoringStrategy": {
                    "strategy": {
                      "Literal": {
                        "Value": "'asZero'"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Color Values:**
- `'minColor'`, `'maxColor'` - Use theme colors
- `"#FF0000"`, `"#00FF00"` - Use hex codes (requires measure)

## Scenario 5: Color Category Axis Labels

**Goal:** Color the category axis labels based on measure value

### Step 1: Add Category Axis Formatting

In `visual.json`, add `objects.categoryAxis`:

```json
{
  "objects": {
    "categoryAxis": [
      {
        "properties": {
          "labelColor": {
            "solid": {
              "color": {
                "expr": {
                  "Measure": {
                    "Expression": {
                      "SourceRef": {
                        "Schema": "extension",
                        "Entity": "Orders"
                      }
                    },
                    "Property": "Bar Color"
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

## Scenario 6: Three-Color Diverging Gradient

**Goal:** Apply diverging color scheme (e.g., red-yellow-green) to bar fills

### Step 1: Edit Visual JSON

No extension measure needed - uses FillRule with linearGradient3:

```json
{
  "objects": {
    "dataPoint": [
      {
        "properties": {
          "fill": {
            "solid": {
              "color": {
                "expr": {
                  "FillRule": {
                    "Input": {
                      "Measure": {
                        "Expression": {
                          "SourceRef": {
                            "Entity": "Orders"
                          }
                        },
                        "Property": "Order Lines"
                      }
                    },
                    "FillRule": {
                      "linearGradient3": {
                        "min": {
                          "color": {
                            "Literal": {
                              "Value": "'#e03131'"
                            }
                          }
                        },
                        "mid": {
                          "color": {
                            "Literal": {
                              "Value": "'#f08c00'"
                            }
                          }
                        },
                        "max": {
                          "color": {
                            "Literal": {
                              "Value": "'#2f9e44'"
                            }
                          }
                        },
                        "nullColoringStrategy": {
                          "strategy": {
                            "Literal": {
                              "Value": "'asZero'"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "selector": {
          "data": [
            {
              "dataViewWildcard": {
                "matchingOption": 1
              }
            }
          ]
        }
      }
    ]
  }
}
```

**Color Options:**
- Use theme colors: `'minColor'`, `'midColor'`, `'maxColor'`
- Use hex codes: `'#e03131'`, `'#f08c00'`, `'#2f9e44'`

**When to Use:**
- Diverging data (negative to positive)
- Performance metrics (bad-neutral-good)
- Temperature scales

## Scenario 7: Rules-Based Conditional Formatting

**Goal:** Apply complex conditional logic (e.g., bottom 3%, greater than 2) - this replicates Power BI UI "Rules" formatting

### Example Rule: Color green if value is in bottom 3%, orange if >= 2

This is the JSON Power BI UI generates for conditional formatting rules. It's complex but allows UI configuration.

```json
{
  "objects": {
    "labels": [
      {},
      {},
      {
        "properties": {
          "color": {
            "solid": {
              "color": {
                "expr": {
                  "Conditional": {
                    "Cases": [
                      {
                        "Condition": {
                          "And": {
                            "Left": {
                              "Comparison": {
                                "ComparisonKind": 2,
                                "Left": {
                                  "Measure": {
                                    "Expression": {
                                      "SourceRef": {
                                        "Entity": "Customers"
                                      }
                                    },
                                    "Property": "# Customers"
                                  }
                                },
                                "Right": {
                                  "RangePercent": {
                                    "Min": {
                                      "ScopedEval": {
                                        "Expression": {
                                          "Aggregation": {
                                            "Expression": {
                                              "ScopedEval": {
                                                "Expression": {
                                                  "Measure": {
                                                    "Expression": {
                                                      "SourceRef": {
                                                        "Entity": "Customers"
                                                      }
                                                    },
                                                    "Property": "# Customers"
                                                  }
                                                },
                                                "Scope": [
                                                  {
                                                    "AllRolesRef": {}
                                                  }
                                                ]
                                              }
                                            },
                                            "Function": 3
                                          }
                                        },
                                        "Scope": []
                                      }
                                    },
                                    "Max": {
                                      "ScopedEval": {
                                        "Expression": {
                                          "Aggregation": {
                                            "Expression": {
                                              "ScopedEval": {
                                                "Expression": {
                                                  "Measure": {
                                                    "Expression": {
                                                      "SourceRef": {
                                                        "Entity": "Customers"
                                                      }
                                                    },
                                                    "Property": "# Customers"
                                                  }
                                                },
                                                "Scope": [
                                                  {
                                                    "AllRolesRef": {}
                                                  }
                                                ]
                                              }
                                            },
                                            "Function": 4
                                          }
                                        },
                                        "Scope": []
                                      }
                                    },
                                    "Percent": 0.03
                                  }
                                }
                              }
                            },
                            "Right": {
                              "Comparison": {
                                "ComparisonKind": 3,
                                "Left": {
                                  "Measure": {
                                    "Expression": {
                                      "SourceRef": {
                                        "Entity": "Customers"
                                      }
                                    },
                                    "Property": "# Customers"
                                  }
                                },
                                "Right": {
                                  "Literal": {
                                    "Value": "0D"
                                  }
                                }
                              }
                            }
                          }
                        },
                        "Value": {
                          "Literal": {
                            "Value": "'#2f9e44'"
                          }
                        }
                      },
                      {
                        "Condition": {
                          "Comparison": {
                            "ComparisonKind": 2,
                            "Left": {
                              "Measure": {
                                "Expression": {
                                  "SourceRef": {
                                    "Entity": "Customers"
                                  }
                                },
                                "Property": "# Customers"
                              }
                            },
                            "Right": {
                              "Literal": {
                                "Value": "2D"
                              }
                            }
                          }
                        },
                        "Value": {
                          "Literal": {
                            "Value": "'#f08c00'"
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        "selector": {
          "data": [
            {
              "dataViewWildcard": {
                "matchingOption": 1
              }
            }
          ]
        }
      }
    ]
  }
}
```

**Key Components:**

- **ComparisonKind values:**
  - 0 = Equal
  - 1 = GreaterThan
  - 2 = GreaterThanOrEqual
  - 3 = LessThan
  - 4 = LessThanOrEqual

- **Aggregation.Function values:**
  - 0 = Sum
  - 1 = Avg
  - 2 = Min
  - 3 = Max
  - 4 = Count
  - 5 = DistinctCount

- **ScopedEval + AllRolesRef:**
  - Evaluates expression at ALL level (ignores all filters)
  - Used for MIN/MAX calculations across entire dataset

- **RangePercent:**
  - Calculates percentage-based range
  - Formula: `MIN(ALL measure) + (MAX(ALL measure) - MIN(ALL measure)) * Percent`
  - Example: If min=0, max=100, Percent=0.03 → range is 0 to 3

**When to Use:**
- Complex business rules
- Top/bottom N or N%
- Multiple conditions combined with AND/OR
- When you want UI-configurable formatting (easier to modify in Power BI UI than DAX)

**Simpler Alternative with Measure:**
Instead of Conditional, create a DAX measure:
```dax
Label Color Rule =
VAR _MinAll = CALCULATE(MIN([# Customers]), ALL(Customers))
VAR _MaxAll = CALCULATE(MAX([# Customers]), ALL(Customers))
VAR _Bottom3Pct = _MinAll + (_MaxAll - _MinAll) * 0.03
VAR _CurrentValue = [# Customers]
RETURN
    SWITCH(
        TRUE(),
        _CurrentValue >= _Bottom3Pct && _CurrentValue > 0, "good",
        _CurrentValue >= 2, "neutral",
        BLANK()
    )
```

## Full Workflow Example

### Goal: Create fully formatted bar chart with all patterns

1. **Create extension measures** in `reportExtensions.json`:
   - `Bar Color` - Returns hex color based on value
   - `Label Title` - Returns custom label text

2. **Edit visual.json** for the bar chart:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.3.0/schema.json",
  "name": "my_bar_chart",
  "position": {
    "x": 50,
    "y": 50,
    "z": 0,
    "height": 400,
    "width": 600
  },
  "visual": {
    "visualType": "clusteredBarChart",
    "query": {
      "queryState": {
        "Category": {
          "projections": [{
            "field": {
              "Column": {
                "Expression": {"SourceRef": {"Entity": "Customers"}},
                "Property": "Key Account Name"
              }
            }
          }]
        },
        "Y": {
          "projections": [{
            "field": {
              "Measure": {
                "Expression": {"SourceRef": {"Entity": "Orders"}},
                "Property": "Order Lines"
              }
            }
          }]
        }
      }
    },
    "objects": {
      "dataPoint": [
        {
          "properties": {
            "fill": {
              "solid": {
                "color": {
                  "expr": {
                    "Measure": {
                      "Expression": {
                        "SourceRef": {
                          "Schema": "extension",
                          "Entity": "Orders"
                        }
                      },
                      "Property": "Bar Color"
                    }
                  }
                }
              }
            }
          },
          "selector": {
            "data": [{"dataViewWildcard": {"matchingOption": 1}}]
          }
        }
      ],
      "labels": [
        {
          "properties": {
            "enableTitleDataLabel": {"expr": {"Literal": {"Value": "true"}}},
            "titleContentType": {"expr": {"Literal": {"Value": "'Custom'"}}},
            "enableDetailDataLabel": {"expr": {"Literal": {"Value": "true"}}},
            "enableBackground": {"expr": {"Literal": {"Value": "true"}}}
          }
        },
        {
          "properties": {
            "dynamicLabelTitle": {
              "expr": {
                "Measure": {
                  "Expression": {
                    "SourceRef": {"Schema": "extension", "Entity": "Customers"}
                  },
                  "Property": "Label Title"
                }
              }
            },
            "dynamicLabelDetail": {
              "expr": {
                "Measure": {
                  "Expression": {"SourceRef": {"Entity": "Invoices"}},
                  "Property": "Invoice Lines"
                }
              }
            }
          },
          "selector": {
            "data": [{"dataViewWildcard": {"matchingOption": 1}}],
            "highlightMatching": 1
          }
        },
        {
          "properties": {
            "titleColor": {
              "solid": {
                "color": {
                  "expr": {
                    "Measure": {
                      "Expression": {
                        "SourceRef": {"Schema": "extension", "Entity": "Orders"}
                      },
                      "Property": "Bar Color"
                    }
                  }
                }
              }
            },
            "color": {
              "solid": {
                "color": {
                  "expr": {
                    "Measure": {
                      "Expression": {
                        "SourceRef": {"Schema": "extension", "Entity": "Orders"}
                      },
                      "Property": "Bar Color"
                    }
                  }
                }
              }
            }
          },
          "selector": {
            "data": [{"dataViewWildcard": {"matchingOption": 1}}]
          }
        }
      ],
      "categoryAxis": [
        {
          "properties": {
            "labelColor": {
              "solid": {
                "color": {
                  "expr": {
                    "Measure": {
                      "Expression": {
                        "SourceRef": {"Schema": "extension", "Entity": "Orders"}
                      },
                      "Property": "Bar Color"
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
}
```

3. **Deploy**:
```bash
fab import "Workspace.Workspace/Report.Report" -i ./Report.Report -f
```

## Common Mistakes

1. **`"Schema": "extension"` only applies to extension measures** (measures defined in `reportExtensions.json`). Do NOT add it to references to real semantic model measures — that will break the reference.
   - Extension measure: `"SourceRef": {"Schema": "extension", "Entity": "Orders"}` — `"Schema": "extension"` REQUIRED
   - Model measure: `"SourceRef": {"Entity": "Sales"}` — `"Schema": "extension"` MUST NOT be present

2. **Missing `matchingOption: 1`** for per-data-point evaluation
   - Without it, formatting applies globally

3. **Wrong array structure** for labels
   - Must use 3 separate entries, not one combined entry

4. **Incorrect selector** for dataPoint
   - Don't add `metadata` selector for bar/column fills
   - Only use `dataViewWildcard`

5. **Color measure returning wrong format**
   - Extension measures should return theme color names: `"good"`, `"bad"`, `"neutral"`, `"minColor"`, `"maxColor"`
   - Literal values in JSON (Conditional, FillRule) must use hex: `"#FF0000"`
   - Don't use arbitrary color names like `"red"` anywhere

## Troubleshooting

**Problem:** Colors not applying
- Check measure returns theme color name (e.g., "good", "bad", "neutral")
- Verify `matchingOption: 1` in selector
- Ensure `"Schema": "extension"` for extension measures

**Problem:** Labels not showing custom content
- Verify `titleContentType: 'Custom'` is set
- Check `enableTitleDataLabel: true`
- Ensure measure returns text/string

**Problem:** Deployment fails
- Validate JSON syntax: `jq empty visual.json`
- Check all extension measures exist in reportExtensions.json
- Verify entity/property names match model

## Related Documentation

- [conditional-formatting.md](../schema-patterns/conditional-formatting.md) - Pattern reference
- [measures.md](../measures.md) - Creating measures
- [selectors.md](../schema-patterns/selectors.md) - Selector patterns
