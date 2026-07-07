#r "System.Drawing"

// TE3 Desktop GUI editor for semantic model AI schema.
// Uses Model.Cultures["en-US"].Content -> Entities.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TabularEditor.TOMWrapper;

try
{
    AiSchemaEditor.Run(Model);
}
catch (Exception ex)
{
    MessageBox.Show(AiSchemaEditor.RootMessage(ex), "Semantic Model AI Schema");
}

public static class AiSchemaEditor
{
    private const string DefaultCultureName = "en-US";

    public static void Run(TabularEditor.TOMWrapper.Model model)
    {
        ScriptHelper.WaitFormVisible = false;

        if (model == null)
        {
            MessageBox.Show("Open or connect to a model before running this script.", "Semantic Model AI Schema");
            return;
        }

        string startupWarning;
        var culture = EnsureCulture(model, DefaultCultureName, out startupWarning);
        if (culture == null)
        {
            MessageBox.Show("Could not find or create the en-US culture.", "Semantic Model AI Schema");
            return;
        }

        using (var form = new Form())
        using (var jsonEditor = ScriptTextEditor.Create("json", false))
        using (var stateImages = BuildStateImages())
        {
            form.Text = "Semantic Model AI Schema";
            form.StartPosition = FormStartPosition.CenterScreen;
            form.AutoScaleMode = AutoScaleMode.Dpi;
            form.Width = 1040;
            form.Height = 780;
            form.MinimumSize = new Size(820, 560);

            var font = new Font("Segoe UI", 9F);

            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 3,
                Padding = new Padding(10)
            };
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 34F));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 58F));

            var header = new Label
            {
                Dock = DockStyle.Fill,
                AutoEllipsis = true,
                TextAlign = ContentAlignment.MiddleLeft,
                Font = font,
                Text = "Model: " + model.Name + "    Culture: " + culture.Name
            };

            var tabs = new TabControl
            {
                Dock = DockStyle.Fill,
                Font = font
            };
            var treePage = new TabPage("Objects");
            var jsonPage = new TabPage("JSON");
            tabs.TabPages.Add(treePage);
            tabs.TabPages.Add(jsonPage);

            var tree = new TreeView
            {
                Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.None,
                Font = font,
                HideSelection = false,
                ShowLines = true,
                ShowPlusMinus = true,
                ShowRootLines = true,
                StateImageList = stateImages
            };

            var treePanel = new Panel
            {
                Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.FixedSingle
            };
            treePanel.Controls.Add(tree);

            var toolbar = new FlowLayoutPanel
            {
                Dock = DockStyle.Top,
                Height = 44,
                FlowDirection = FlowDirection.LeftToRight,
                WrapContents = false,
                Padding = new Padding(0, 6, 0, 4)
            };
            var showHidden = new CheckBox { Text = "Show hidden", Checked = true, AutoSize = true, Font = font, Padding = new Padding(0, 7, 12, 0) };
            var checkAllButton = NewToolbarButton("Check all", font);
            var clearButton = NewToolbarButton("Clear", font);
            var expandButton = NewToolbarButton("Expand", font);
            var collapseButton = NewToolbarButton("Collapse", font);
            toolbar.Controls.Add(showHidden);
            toolbar.Controls.Add(checkAllButton);
            toolbar.Controls.Add(clearButton);
            toolbar.Controls.Add(expandButton);
            toolbar.Controls.Add(collapseButton);

            var treeLayout = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0) };
            treeLayout.Controls.Add(treePanel);
            treeLayout.Controls.Add(toolbar);
            treePage.Controls.Add(treeLayout);

            var jsonPanel = new Panel
            {
                Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(0)
            };
            jsonPanel.Controls.Add(jsonEditor.Control);
            jsonPage.Controls.Add(jsonPanel);

            var bottom = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 1,
                Margin = new Padding(0),
                Padding = new Padding(0, 8, 0, 4)
            };
            bottom.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            bottom.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));

            var status = new Label
            {
                Dock = DockStyle.Fill,
                AutoEllipsis = true,
                TextAlign = ContentAlignment.MiddleLeft,
                Font = font,
                ForeColor = string.IsNullOrWhiteSpace(startupWarning) ? SystemColors.ControlText : Color.DarkGoldenrod,
                Margin = new Padding(0, 0, 8, 0)
            };

            var reloadButton = NewFooterButton("Reload", font);
            var formatButton = NewFooterButton("Format JSON", font);
            var updateJsonButton = NewFooterButton("Update JSON", font);
            var saveButton = NewFooterButton("Save", font);
            var closeButton = NewFooterButton("Close", font);
            closeButton.DialogResult = DialogResult.Cancel;

            var buttonStrip = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                AutoSize = true,
                AutoSizeMode = AutoSizeMode.GrowAndShrink,
                FlowDirection = FlowDirection.LeftToRight,
                WrapContents = false,
                Margin = new Padding(0),
                Padding = new Padding(0)
            };
            buttonStrip.Controls.Add(reloadButton);
            buttonStrip.Controls.Add(formatButton);
            buttonStrip.Controls.Add(updateJsonButton);
            buttonStrip.Controls.Add(saveButton);
            buttonStrip.Controls.Add(closeButton);

            bottom.Controls.Add(status, 0, 0);
            bottom.Controls.Add(buttonStrip, 1, 0);

            layout.Controls.Add(header, 0, 0);
            layout.Controls.Add(tabs, 0, 1);
            layout.Controls.Add(bottom, 0, 2);
            form.Controls.Add(layout);
            form.CancelButton = closeButton;

            bool updatingTree = false;

            Action<JObject> loadSchemaIntoUi = schema =>
            {
                updatingTree = true;
                try
                {
                    BuildTree(tree, model, schema, showHidden.Checked);
                    jsonEditor.Text = NormalizeForEditor(schema.ToString(Formatting.Indented));
                    status.Text = StatusText(tree, startupWarning);
                    status.ForeColor = string.IsNullOrWhiteSpace(startupWarning) ? SystemColors.ControlText : Color.DarkGoldenrod;
                }
                finally
                {
                    updatingTree = false;
                }
            };

            Action reload = () =>
            {
                try
                {
                    loadSchemaIntoUi(GetSchema(culture));
                }
                catch (Exception ex)
                {
                    status.Text = RootMessage(ex);
                    status.ForeColor = Color.Firebrick;
                }
            };

            tree.NodeMouseClick += (sender, args) =>
            {
                if (updatingTree) return;
                try
                {
                    ToggleNode(args.Node);
                    status.Text = StatusText(tree, startupWarning);
                    status.ForeColor = SystemColors.ControlText;
                }
                catch (Exception ex)
                {
                    status.Text = RootMessage(ex);
                    status.ForeColor = Color.Firebrick;
                }
            };

            showHidden.CheckedChanged += (sender, args) =>
            {
                if (updatingTree) return;
                try
                {
                    var current = SchemaFromTree(tree);
                    loadSchemaIntoUi(current);
                }
                catch (Exception ex)
                {
                    status.Text = RootMessage(ex);
                    status.ForeColor = Color.Firebrick;
                }
            };

            checkAllButton.Click += (sender, args) =>
            {
                SetAllTreeNodes(tree, CheckedState);
                status.Text = StatusText(tree, startupWarning);
                status.ForeColor = SystemColors.ControlText;
            };
            clearButton.Click += (sender, args) =>
            {
                SetAllTreeNodes(tree, UncheckedState);
                status.Text = StatusText(tree, startupWarning);
                status.ForeColor = SystemColors.ControlText;
            };
            expandButton.Click += (sender, args) => tree.ExpandAll();
            collapseButton.Click += (sender, args) => tree.CollapseAll();

            reloadButton.Click += (sender, args) => reload();
            formatButton.Click += (sender, args) =>
            {
                try
                {
                    jsonEditor.Text = NormalizeForEditor(JObject.Parse(jsonEditor.Text).ToString(Formatting.Indented));
                    tabs.SelectedTab = jsonPage;
                    status.Text = "JSON formatted.";
                    status.ForeColor = SystemColors.ControlText;
                }
                catch (Exception ex)
                {
                    status.Text = RootMessage(ex);
                    status.ForeColor = Color.Firebrick;
                }
            };
            updateJsonButton.Click += (sender, args) =>
            {
                try
                {
                    jsonEditor.Text = NormalizeForEditor(SchemaFromTree(tree).ToString(Formatting.Indented));
                    tabs.SelectedTab = jsonPage;
                    jsonEditor.SelectStart();
                    status.Text = "JSON updated from object tree.";
                    status.ForeColor = SystemColors.ControlText;
                }
                catch (Exception ex)
                {
                    status.Text = RootMessage(ex);
                    status.ForeColor = Color.Firebrick;
                }
            };
            saveButton.Click += (sender, args) =>
            {
                try
                {
                    JObject schema;
                    if (tabs.SelectedTab == jsonPage)
                    {
                        schema = JObject.Parse(jsonEditor.Text);
                        SetSchema(culture, schema);
                        loadSchemaIntoUi(schema);
                        tabs.SelectedTab = jsonPage;
                    }
                    else
                    {
                        schema = SchemaFromTree(tree);
                        SetSchema(culture, schema);
                        jsonEditor.Text = NormalizeForEditor(schema.ToString(Formatting.Indented));
                    }

                    status.Text = "Saved to " + culture.Name + ". Save the model to persist.";
                    status.ForeColor = Color.ForestGreen;
                }
                catch (Exception ex)
                {
                    status.Text = RootMessage(ex);
                    status.ForeColor = Color.Firebrick;
                }
            };
            closeButton.Click += (sender, args) => form.Close();

            reload();
            form.ShowDialog();
        }
    }

    private const int UncheckedState = 0;
    private const int CheckedState = 1;
    private const int MixedState = 2;

    private static void BuildTree(TreeView tree, TabularEditor.TOMWrapper.Model model, JObject schema, bool showHidden)
    {
        tree.BeginUpdate();
        try
        {
            tree.Nodes.Clear();
            var index = BuildSchemaIndex(schema);
            var hasSchema = index.Count > 0;

            foreach (var table in model.Tables.OrderBy(t => t.Name))
            {
                if (!showHidden && !IsVisibleObject(table)) continue;

                var tableNode = NewNode(table.Name, new SchemaNode("table", table.Name, null, null, null));
                tree.Nodes.Add(tableNode);

                foreach (var column in table.Columns.OrderBy(c => c.Name))
                {
                    if (!showHidden && !IsVisibleObject(column)) continue;
                    var node = NewNode(column.Name + "    column", new SchemaNode("column", table.Name, column.Name, null, null));
                    node.ForeColor = IsVisibleObject(column) ? SystemColors.WindowText : SystemColors.GrayText;
                    node.StateImageIndex = IncludeState(index, node.Tag as SchemaNode, hasSchema, IsVisibleObject(column));
                    tableNode.Nodes.Add(node);
                }

                foreach (var measure in table.Measures.OrderBy(m => m.Name))
                {
                    if (!showHidden && !IsVisibleObject(measure)) continue;
                    var node = NewNode(measure.Name + "    measure", new SchemaNode("measure", table.Name, measure.Name, null, null));
                    node.ForeColor = IsVisibleObject(measure) ? SystemColors.WindowText : SystemColors.GrayText;
                    node.StateImageIndex = IncludeState(index, node.Tag as SchemaNode, hasSchema, IsVisibleObject(measure));
                    tableNode.Nodes.Add(node);
                }

                foreach (var hierarchy in table.Hierarchies.OrderBy(h => h.Name))
                {
                    if (!showHidden && !IsVisibleObject(hierarchy)) continue;
                    var hierarchyNode = NewNode(hierarchy.Name + "    hierarchy", new SchemaNode("hierarchy", table.Name, null, hierarchy.Name, null));
                    hierarchyNode.ForeColor = IsVisibleObject(hierarchy) ? SystemColors.WindowText : SystemColors.GrayText;
                    hierarchyNode.StateImageIndex = IncludeState(index, hierarchyNode.Tag as SchemaNode, hasSchema, IsVisibleObject(hierarchy));
                    tableNode.Nodes.Add(hierarchyNode);

                    foreach (var level in hierarchy.Levels.OrderBy(l => l.Name))
                    {
                        var levelNode = NewNode(level.Name + "    level", new SchemaNode("level", table.Name, null, hierarchy.Name, level.Name));
                        levelNode.StateImageIndex = IncludeState(index, levelNode.Tag as SchemaNode, hasSchema, true);
                        hierarchyNode.Nodes.Add(levelNode);
                    }

                    if (hierarchyNode.Nodes.Count > 0 && !index.ContainsKey(Key(hierarchyNode.Tag as SchemaNode)))
                    {
                        hierarchyNode.StateImageIndex = AggregateState(hierarchyNode);
                    }
                }

                tableNode.ForeColor = IsVisibleObject(table) ? SystemColors.WindowText : SystemColors.GrayText;
                tableNode.StateImageIndex = index.ContainsKey(Key(tableNode.Tag as SchemaNode))
                    ? index[Key(tableNode.Tag as SchemaNode)] ? CheckedState : UncheckedState
                    : tableNode.Nodes.Count == 0 ? (IsVisibleObject(table) || !hasSchema ? CheckedState : UncheckedState) : AggregateState(tableNode);
                tableNode.Expand();
            }
        }
        finally
        {
            tree.EndUpdate();
        }
    }

    private static Button NewFooterButton(string text, Font font)
    {
        return new Button
        {
            Text = text,
            Dock = DockStyle.Fill,
            Font = font,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            Margin = new Padding(6, 2, 0, 2),
            MinimumSize = new Size(96, 32),
            Padding = new Padding(12, 0, 12, 0),
            TextAlign = ContentAlignment.MiddleCenter,
            UseVisualStyleBackColor = true
        };
    }

    private static Button NewToolbarButton(string text, Font font)
    {
        return new Button
        {
            Text = text,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            Font = font,
            Margin = new Padding(6, 0, 0, 0),
            MinimumSize = new Size(96, 30),
            Padding = new Padding(12, 0, 12, 0),
            TextAlign = ContentAlignment.MiddleCenter,
            UseVisualStyleBackColor = true
        };
    }

    private static TreeNode NewNode(string text, SchemaNode tag)
    {
        return new TreeNode(text)
        {
            Tag = tag,
            StateImageIndex = CheckedState
        };
    }

    private static bool IsVisibleObject(object obj)
    {
        if (obj is IHideableObject hideable) return hideable.IsVisible;
        return true;
    }

    private static int IncludeState(Dictionary<string, bool> index, SchemaNode node, bool hasSchema, bool visible)
    {
        var key = Key(node);
        if (index.ContainsKey(key)) return index[key] ? CheckedState : UncheckedState;
        return !hasSchema || visible ? CheckedState : UncheckedState;
    }

    private static Dictionary<string, bool> BuildSchemaIndex(JObject schema)
    {
        var result = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        foreach (var tableEntry in CollectionEntries(schema?["tables"] ?? schema?["Tables"]))
        {
            var table = tableEntry.Value as JObject;
            var tableName = SchemaObjectName(tableEntry.Key, tableEntry.Value);
            if (string.IsNullOrWhiteSpace(tableName)) continue;

            result[Key(new SchemaNode("table", tableName, null, null, null))] = IncludeValue(tableEntry.Value);

            foreach (var columnEntry in CollectionEntries(table?["columns"] ?? table?["Columns"]))
            {
                var name = SchemaObjectName(columnEntry.Key, columnEntry.Value);
                if (!string.IsNullOrWhiteSpace(name)) result[Key(new SchemaNode("column", tableName, name, null, null))] = IncludeValue(columnEntry.Value);
            }

            foreach (var measureEntry in CollectionEntries(table?["measures"] ?? table?["Measures"]))
            {
                var name = SchemaObjectName(measureEntry.Key, measureEntry.Value);
                if (!string.IsNullOrWhiteSpace(name)) result[Key(new SchemaNode("measure", tableName, name, null, null))] = IncludeValue(measureEntry.Value);
            }

            foreach (var hierarchyEntry in CollectionEntries(table?["hierarchies"] ?? table?["Hierarchies"]))
            {
                var hierarchy = hierarchyEntry.Value as JObject;
                var name = SchemaObjectName(hierarchyEntry.Key, hierarchyEntry.Value);
                if (string.IsNullOrWhiteSpace(name)) continue;
                result[Key(new SchemaNode("hierarchy", tableName, null, name, null))] = IncludeValue(hierarchyEntry.Value);

                foreach (var levelEntry in CollectionEntries(hierarchy?["levels"] ?? hierarchy?["Levels"]))
                {
                    var level = SchemaObjectName(levelEntry.Key, levelEntry.Value);
                    if (!string.IsNullOrWhiteSpace(level)) result[Key(new SchemaNode("level", tableName, null, name, level))] = IncludeValue(levelEntry.Value);
                }
            }
        }
        return result;
    }

    private static string Key(SchemaNode node)
    {
        if (node == null) return "";
        if (node.Kind == "table") return "T|" + node.Table;
        if (node.Kind == "column" || node.Kind == "measure") return "P|" + node.Table + "|" + node.Property;
        if (node.Kind == "hierarchy") return "H|" + node.Table + "|" + node.Hierarchy;
        if (node.Kind == "level") return "L|" + node.Table + "|" + node.Hierarchy + "|" + node.Level;
        return "";
    }

    private static void ToggleNode(TreeNode node)
    {
        var next = node.StateImageIndex == CheckedState ? UncheckedState : CheckedState;
        SetNodeAndChildren(node, next);
        RefreshAncestors(node.Parent);
    }

    private static void SetAllTreeNodes(TreeView tree, int state)
    {
        tree.BeginUpdate();
        try
        {
            foreach (TreeNode node in tree.Nodes)
            {
                SetNodeAndChildren(node, state);
            }
        }
        finally
        {
            tree.EndUpdate();
        }
    }

    private static void SetNodeAndChildren(TreeNode node, int state)
    {
        node.StateImageIndex = state;
        foreach (TreeNode child in node.Nodes)
        {
            SetNodeAndChildren(child, state);
        }
    }

    private static void RefreshAncestors(TreeNode node)
    {
        while (node != null)
        {
            node.StateImageIndex = AggregateState(node);
            node = node.Parent;
        }
    }

    private static int AggregateState(TreeNode node)
    {
        if (node.Nodes.Count == 0) return node.StateImageIndex == CheckedState ? CheckedState : UncheckedState;

        var checkedCount = 0;
        var uncheckedCount = 0;
        foreach (TreeNode child in node.Nodes)
        {
            if (child.StateImageIndex == CheckedState) checkedCount++;
            else if (child.StateImageIndex == UncheckedState) uncheckedCount++;
            else return MixedState;
        }

        if (checkedCount == node.Nodes.Count) return CheckedState;
        if (uncheckedCount == node.Nodes.Count) return UncheckedState;
        return MixedState;
    }

    private static JObject SchemaFromTree(TreeView tree)
    {
        var tables = new JArray();
        foreach (TreeNode tableNode in tree.Nodes)
        {
            var tableTag = tableNode.Tag as SchemaNode;
            if (tableTag == null || tableTag.Kind != "table") continue;

            var table = new JObject
            {
                ["name"] = tableTag.Table,
                ["include"] = tableNode.StateImageIndex != UncheckedState
            };
            var columns = new JArray();
            var measures = new JArray();
            var hierarchies = new JArray();

            foreach (TreeNode child in tableNode.Nodes)
            {
                var tag = child.Tag as SchemaNode;
                if (tag == null) continue;

                if (tag.Kind == "column")
                {
                    columns.Add(new JObject { ["name"] = tag.Property, ["include"] = child.StateImageIndex == CheckedState });
                }
                else if (tag.Kind == "measure")
                {
                    measures.Add(new JObject { ["name"] = tag.Property, ["include"] = child.StateImageIndex == CheckedState });
                }
                else if (tag.Kind == "hierarchy")
                {
                    var hierarchy = new JObject
                    {
                        ["name"] = tag.Hierarchy,
                        ["include"] = child.StateImageIndex != UncheckedState
                    };
                    var levels = new JArray();
                    foreach (TreeNode levelNode in child.Nodes)
                    {
                        var levelTag = levelNode.Tag as SchemaNode;
                        if (levelTag != null && levelTag.Kind == "level")
                        {
                            levels.Add(new JObject { ["name"] = levelTag.Level, ["include"] = levelNode.StateImageIndex == CheckedState });
                        }
                    }
                    if (levels.Count > 0) hierarchy["levels"] = levels;
                    hierarchies.Add(hierarchy);
                }
            }

            if (columns.Count > 0) table["columns"] = columns;
            if (measures.Count > 0) table["measures"] = measures;
            if (hierarchies.Count > 0) table["hierarchies"] = hierarchies;
            tables.Add(table);
        }

        return new JObject { ["tables"] = tables };
    }

    private static string StatusText(TreeView tree, string startupWarning)
    {
        var total = 0;
        var included = 0;
        CountNodes(tree.Nodes, ref total, ref included);
        return included + " included / " + total + " objects" +
            (string.IsNullOrWhiteSpace(startupWarning) ? "" : "    " + startupWarning);
    }

    private static void CountNodes(TreeNodeCollection nodes, ref int total, ref int included)
    {
        foreach (TreeNode node in nodes)
        {
            if (node.Tag is SchemaNode)
            {
                total++;
                if (node.StateImageIndex != UncheckedState) included++;
            }
            CountNodes(node.Nodes, ref total, ref included);
        }
    }

    private static ImageList BuildStateImages()
    {
        var list = new ImageList { ImageSize = new Size(16, 16), ColorDepth = ColorDepth.Depth32Bit };
        list.Images.Add(DrawStateImage(UncheckedState));
        list.Images.Add(DrawStateImage(CheckedState));
        list.Images.Add(DrawStateImage(MixedState));
        return list;
    }

    private static Bitmap DrawStateImage(int state)
    {
        var bmp = new Bitmap(16, 16);
        using (var g = Graphics.FromImage(bmp))
        using (var border = new Pen(Color.FromArgb(120, 120, 120)))
        using (var fill = new SolidBrush(Color.White))
        using (var mark = new Pen(Color.FromArgb(0, 120, 215), 2F))
        using (var mixed = new SolidBrush(Color.FromArgb(0, 120, 215)))
        {
            g.Clear(Color.Transparent);
            g.FillRectangle(fill, 2, 2, 12, 12);
            g.DrawRectangle(border, 2, 2, 12, 12);
            if (state == CheckedState)
            {
                g.DrawLines(mark, new[] { new Point(4, 8), new Point(7, 11), new Point(12, 5) });
            }
            else if (state == MixedState)
            {
                g.FillRectangle(mixed, 5, 7, 6, 2);
            }
        }
        return bmp;
    }

    private sealed class SchemaNode
    {
        public readonly string Kind;
        public readonly string Table;
        public readonly string Property;
        public readonly string Hierarchy;
        public readonly string Level;

        public SchemaNode(string kind, string table, string property, string hierarchy, string level)
        {
            Kind = kind;
            Table = table;
            Property = property;
            Hierarchy = hierarchy;
            Level = level;
        }
    }

    private static Culture EnsureCulture(TabularEditor.TOMWrapper.Model model, string cultureName, out string warning)
    {
        warning = null;

        if (model.Cultures.Contains(cultureName)) return model.Cultures[cultureName];

        try
        {
            return model.AddTranslation(cultureName);
        }
        catch
        {
            // Power BI Desktop-connected models may block AddTranslation. Fall back to TE's import helper.
        }

        try
        {
            if (TryImportEmptyCulture(model, cultureName) && model.Cultures.Contains(cultureName))
            {
                warning = "Created " + cultureName + " culture.";
                return model.Cultures[cultureName];
            }
        }
        catch
        {
            // Fall through to an existing culture or a controlled message.
        }

        var fallback = model.Cultures.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.Content))
            ?? model.Cultures.FirstOrDefault();
        if (fallback != null)
        {
            warning = "Could not create " + cultureName + "; using " + fallback.Name + ".";
            return fallback;
        }

        return null;
    }

    private static bool TryImportEmptyCulture(TabularEditor.TOMWrapper.Model model, string cultureName)
    {
        var helperType = typeof(TabularEditor.TOMWrapper.Model).Assembly.GetType("TabularEditor.TOMWrapper.TabularCultureHelper");
        if (helperType == null) return false;

        var method = helperType.GetMethod("ImportCulture", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
        if (method == null) return false;

        var cultureJson = new JObject { ["name"] = cultureName };
        var result = method.Invoke(null, new object[] { cultureJson, model, false, true });
        return result is bool ok && ok;
    }

    private static JObject GetSchema(Culture culture)
    {
        var payload = GetPayload(culture, false);
        return SchemaFromEntities(payload["Entities"] as JObject);
    }

    private static void SetSchema(Culture culture, JObject schema)
    {
        var payload = GetPayload(culture, true);
        payload["Entities"] = EntitiesFromSchema(schema);
        SavePayload(culture, payload);
    }

    private static JObject GetPayload(Culture culture, bool create)
    {
        if (!string.IsNullOrWhiteSpace(culture.Content))
        {
            return JObject.Parse(culture.Content);
        }

        if (!create) return new JObject();

        return new JObject
        {
            ["Version"] = "4.2.0",
            ["Language"] = culture.Name,
            ["Entities"] = new JObject(),
            ["Agents"] = new JObject
            {
                ["Internal"] = new JObject { ["Version"] = "1.1.0" }
            }
        };
    }

    private static void SavePayload(Culture culture, JObject payload)
    {
        culture.Content = payload.ToString(Formatting.Indented);
    }

    private static JObject SchemaFromEntities(JObject entities)
    {
        var tableMap = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);
        var orderedTables = new JArray();

        if (entities == null) return new JObject { ["tables"] = orderedTables };

        foreach (var property in entities.Properties())
        {
            var entity = property.Value as JObject;
            if (entity == null) continue;

            var binding = BindingFromEntity(entity);
            if (binding == null) continue;

            var tableName = StringValue(binding, "ConceptualEntity");
            if (string.IsNullOrWhiteSpace(tableName)) continue;

            var include = EntityIncluded(entity);
            var table = GetOrAddTable(tableMap, orderedTables, tableName);
            var propertyName = StringValue(binding, "ConceptualProperty");
            var hierarchyName = StringValue(binding, "Hierarchy");
            var levelName = StringValue(binding, "HierarchyLevel");

            if (!string.IsNullOrWhiteSpace(levelName))
            {
                var hierarchy = GetOrAddHierarchy(table, hierarchyName);
                GetArray(hierarchy, "levels").Add(new JObject { ["name"] = levelName, ["include"] = include });
            }
            else if (!string.IsNullOrWhiteSpace(hierarchyName))
            {
                var hierarchy = GetOrAddHierarchy(table, hierarchyName);
                hierarchy["include"] = include;
            }
            else if (!string.IsNullOrWhiteSpace(propertyName))
            {
                GetArray(table, "columns").Add(new JObject { ["name"] = propertyName, ["include"] = include });
            }
            else
            {
                table["include"] = include;
            }
        }

        RemoveEmptyArrays(orderedTables);
        return new JObject { ["tables"] = orderedTables };
    }

    private static JObject EntitiesFromSchema(JObject schema)
    {
        var entities = new JObject();
        var usedIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var tableEntry in CollectionEntries(schema["tables"] ?? schema["Tables"]))
        {
            var table = tableEntry.Value as JObject;
            var tableName = SchemaObjectName(tableEntry.Key, tableEntry.Value);
            if (string.IsNullOrWhiteSpace(tableName)) continue;

            AddEntity(entities, usedIds, tableName, IncludeValue(tableEntry.Value), tableName, null, null, null);

            foreach (var columnEntry in CollectionEntries(table?["columns"] ?? table?["Columns"]))
            {
                var columnName = SchemaObjectName(columnEntry.Key, columnEntry.Value);
                if (!string.IsNullOrWhiteSpace(columnName)) AddEntity(entities, usedIds, tableName + "_" + columnName, IncludeValue(columnEntry.Value), tableName, columnName, null, null);
            }

            foreach (var measureEntry in CollectionEntries(table?["measures"] ?? table?["Measures"]))
            {
                var measureName = SchemaObjectName(measureEntry.Key, measureEntry.Value);
                if (!string.IsNullOrWhiteSpace(measureName)) AddEntity(entities, usedIds, tableName + "_" + measureName, IncludeValue(measureEntry.Value), tableName, measureName, null, null);
            }

            foreach (var hierarchyEntry in CollectionEntries(table?["hierarchies"] ?? table?["Hierarchies"]))
            {
                var hierarchy = hierarchyEntry.Value as JObject;
                var hierarchyName = SchemaObjectName(hierarchyEntry.Key, hierarchyEntry.Value);
                if (string.IsNullOrWhiteSpace(hierarchyName)) continue;

                AddEntity(entities, usedIds, tableName + "_" + hierarchyName, IncludeValue(hierarchyEntry.Value), tableName, null, hierarchyName, null);

                foreach (var levelEntry in CollectionEntries(hierarchy?["levels"] ?? hierarchy?["Levels"]))
                {
                    var levelName = SchemaObjectName(levelEntry.Key, levelEntry.Value);
                    if (!string.IsNullOrWhiteSpace(levelName)) AddEntity(entities, usedIds, tableName + "_" + hierarchyName + "_" + levelName, IncludeValue(levelEntry.Value), tableName, null, hierarchyName, levelName);
                }
            }
        }

        return entities;
    }

    private static JObject BindingFromEntity(JObject entity)
    {
        if (entity["Binding"] is JObject binding) return binding;
        if (entity["Definition"] is JObject definition && definition["Binding"] is JObject nestedBinding) return nestedBinding;
        return null;
    }

    private static bool EntityIncluded(JObject entity)
    {
        var state = StringValue(entity, "State") ?? "Generated";
        var normalized = state.Trim().ToLowerInvariant();
        return normalized != "deleted" && normalized != "hidden" && normalized != "disabled";
    }

    private static string StringValue(JObject obj, string name)
    {
        return (string)(obj[name] ?? obj[Char.ToLowerInvariant(name[0]) + name.Substring(1)]);
    }

    private static JObject GetOrAddTable(Dictionary<string, JObject> tableMap, JArray orderedTables, string tableName)
    {
        if (tableMap.TryGetValue(tableName, out var table)) return table;

        table = new JObject
        {
            ["name"] = tableName,
            ["include"] = true,
            ["columns"] = new JArray(),
            ["hierarchies"] = new JArray()
        };
        tableMap[tableName] = table;
        orderedTables.Add(table);
        return table;
    }

    private static JObject GetOrAddHierarchy(JObject table, string hierarchyName)
    {
        var name = hierarchyName ?? "";
        var hierarchies = GetArray(table, "hierarchies");
        foreach (var existing in hierarchies.OfType<JObject>())
        {
            if (string.Equals((string)existing["name"], name, StringComparison.OrdinalIgnoreCase)) return existing;
        }

        var hierarchy = new JObject
        {
            ["name"] = name,
            ["include"] = true,
            ["levels"] = new JArray()
        };
        hierarchies.Add(hierarchy);
        return hierarchy;
    }

    private static JArray GetArray(JObject obj, string propertyName)
    {
        if (!(obj[propertyName] is JArray array))
        {
            array = new JArray();
            obj[propertyName] = array;
        }
        return array;
    }

    private static void RemoveEmptyArrays(JArray tables)
    {
        foreach (var table in tables.OfType<JObject>())
        {
            if (table["columns"] is JArray columns && columns.Count == 0) table.Remove("columns");
            if (table["hierarchies"] is JArray hierarchies)
            {
                foreach (var hierarchy in hierarchies.OfType<JObject>())
                {
                    if (hierarchy["levels"] is JArray levels && levels.Count == 0) hierarchy.Remove("levels");
                }
                if (hierarchies.Count == 0) table.Remove("hierarchies");
            }
        }
    }

    private static IEnumerable<KeyValuePair<string, JToken>> CollectionEntries(JToken value)
    {
        if (value is JArray array)
        {
            foreach (var item in array)
            {
                yield return new KeyValuePair<string, JToken>(SchemaObjectName(null, item), item);
            }
            yield break;
        }

        if (value is JObject obj)
        {
            foreach (var property in obj.Properties())
            {
                yield return new KeyValuePair<string, JToken>(property.Name, property.Value);
            }
        }
    }

    private static string SchemaObjectName(string key, JToken value)
    {
        if (value is JObject obj)
        {
            return (string)(obj["name"] ?? obj["Name"] ?? obj["id"] ?? obj["Id"]) ?? key;
        }
        return key;
    }

    private static bool IncludeValue(JToken value)
    {
        if (value != null && value.Type == JTokenType.Boolean) return (bool)value;

        if (value is JObject obj)
        {
            var include = obj["include"] ?? obj["Include"] ?? obj["enabled"] ?? obj["Enabled"] ?? obj["selected"] ?? obj["Selected"];
            if (include != null && include.Type == JTokenType.Boolean) return (bool)include;

            var visibility = ((string)(obj["visibility"] ?? obj["Visibility"]) ?? "").Trim().ToLowerInvariant();
            if (visibility == "hidden") return false;
            if (visibility == "visible") return true;
        }

        return true;
    }

    private static void AddEntity(JObject entities, HashSet<string> usedIds, string rawId, bool include, string table, string property, string hierarchy, string level)
    {
        var binding = new JObject { ["ConceptualEntity"] = table };
        if (!string.IsNullOrWhiteSpace(property)) binding["ConceptualProperty"] = property;
        if (!string.IsNullOrWhiteSpace(hierarchy)) binding["Hierarchy"] = hierarchy;
        if (!string.IsNullOrWhiteSpace(level)) binding["HierarchyLevel"] = level;

        entities[UniqueEntityId(rawId, usedIds)] = new JObject
        {
            ["Binding"] = binding,
            ["State"] = include ? "Generated" : "Hidden"
        };
    }

    private static string UniqueEntityId(string raw, HashSet<string> usedIds)
    {
        var baseId = Regex.Replace((raw ?? "entity").Trim().ToLowerInvariant(), "[^a-z0-9]+", "_").Trim('_');
        if (string.IsNullOrWhiteSpace(baseId)) baseId = "entity";

        var candidate = baseId;
        var index = 2;
        while (usedIds.Contains(candidate))
        {
            candidate = baseId + "_" + index;
            index++;
        }
        usedIds.Add(candidate);
        return candidate;
    }

    private static string NormalizeForEditor(string text)
    {
        return (text ?? "").Replace("\r\n", "\n").Replace("\r", "\n").Replace("\n", Environment.NewLine);
    }

    public static string RootMessage(Exception ex)
    {
        if (ex == null) return "";
        while (ex.InnerException != null) ex = ex.InnerException;
        return ex.Message;
    }
}

public sealed class ScriptTextEditor : IDisposable
{
    private readonly object scintilla;
    private readonly TextBox textBox;
    private bool wordWrap;

    public Control Control { get; private set; }
    public bool IsScintilla { get { return scintilla != null; } }
    public event EventHandler TextChanged;

    private ScriptTextEditor(object scintillaControl, TextBox fallbackTextBox, bool initialWordWrap)
    {
        scintilla = scintillaControl;
        textBox = fallbackTextBox;
        Control = (Control)(scintillaControl ?? (object)fallbackTextBox);
        wordWrap = initialWordWrap;
        Control.TextChanged += (sender, args) => TextChanged?.Invoke(this, EventArgs.Empty);
    }

    public static ScriptTextEditor Create(string lexerName, bool wordWrap)
    {
        try
        {
            var assembly = AppDomain.CurrentDomain.GetAssemblies()
                .FirstOrDefault(a => string.Equals(a.GetName().Name, "ScintillaNET", StringComparison.OrdinalIgnoreCase))
                ?? Assembly.Load("ScintillaNET");
            var type = assembly.GetType("ScintillaNET.Scintilla", true);
            var control = (Control)Activator.CreateInstance(type);
            ConfigureScintilla(control, lexerName, wordWrap);
            return new ScriptTextEditor(control, null, wordWrap);
        }
        catch
        {
            var fallback = new TextBox
            {
                Dock = DockStyle.Fill,
                Multiline = true,
                ScrollBars = ScrollBars.Both,
                WordWrap = wordWrap,
                AcceptsReturn = true,
                AcceptsTab = true,
                Font = new Font("Consolas", 10F),
                BorderStyle = BorderStyle.None
            };
            return new ScriptTextEditor(null, fallback, wordWrap);
        }
    }

    public string Text
    {
        get { return Control.Text ?? ""; }
        set { Control.Text = value ?? ""; }
    }

    public bool WordWrap
    {
        get { return wordWrap; }
        set
        {
            wordWrap = value;
            if (textBox != null)
            {
                textBox.WordWrap = value;
                return;
            }

            SetEnumProperty(scintilla, "WrapMode", value ? "Word" : "None");
            SetProperty(scintilla, "HScrollBar", !value);
        }
    }

    public void SelectStart()
    {
        if (textBox != null)
        {
            textBox.SelectionStart = 0;
            textBox.SelectionLength = 0;
            return;
        }

        SetProperty(scintilla, "CurrentPosition", 0);
        SetProperty(scintilla, "AnchorPosition", 0);
    }

    public void Dispose()
    {
        Control?.Dispose();
    }

    private static void ConfigureScintilla(Control control, string lexerName, bool wordWrap)
    {
        control.Dock = DockStyle.Fill;
        control.Font = new Font("Consolas", 10F);
        control.BackColor = Color.White;

        var target = (object)control;
        SetEnumProperty(target, "BorderStyle", "None");
        SetProperty(target, "LexerName", lexerName);
        SetEnumProperty(target, "WrapMode", wordWrap ? "Word" : "None");
        SetEnumProperty(target, "WrapIndentMode", "Indent");
        SetProperty(target, "ScrollWidthTracking", true);
        SetProperty(target, "MultipleSelection", true);
        SetProperty(target, "AdditionalSelectionTyping", true);
        SetProperty(target, "MouseSelectionRectangularSwitch", true);
        SetProperty(target, "HScrollBar", !wordWrap);
        SetProperty(target, "VScrollBar", true);
        ConfigureMargins(target);
        ConfigureContextMenu(control, target);
    }

    private static void ConfigureMargins(object target)
    {
        var margins = GetProperty(target, "Margins");
        if (margins == null) return;

        var lineMargin = GetIndexerValue(margins, 0);
        if (lineMargin != null)
        {
            SetProperty(lineMargin, "Width", 42);
            SetEnumProperty(lineMargin, "Type", "Number");
            SetEnumProperty(lineMargin, "Cursor", "ReverseArrow");
        }

        var foldMargin = GetIndexerValue(margins, 2);
        if (foldMargin != null)
        {
            SetProperty(foldMargin, "Width", 16);
            SetProperty(foldMargin, "Sensitive", true);
            SetEnumProperty(foldMargin, "Type", "Symbol");
            SetEnumProperty(foldMargin, "Cursor", "Arrow");
        }
    }

    private static void ConfigureContextMenu(Control control, object target)
    {
        var menu = new ContextMenuStrip();
        AddMenuItem(menu, "Undo", () => InvokeNoArgs(target, "Undo"));
        AddMenuItem(menu, "Redo", () => InvokeNoArgs(target, "Redo"));
        menu.Items.Add(new ToolStripSeparator());
        AddMenuItem(menu, "Cut", () => InvokeNoArgs(target, "Cut"));
        AddMenuItem(menu, "Copy", () => InvokeNoArgs(target, "Copy"));
        AddMenuItem(menu, "Paste", () => InvokeNoArgs(target, "Paste"));
        menu.Items.Add(new ToolStripSeparator());
        AddMenuItem(menu, "Select All", () => InvokeNoArgs(target, "SelectAll"));
        control.ContextMenuStrip = menu;
    }

    private static void AddMenuItem(ContextMenuStrip menu, string text, Action action)
    {
        var item = new ToolStripMenuItem(text);
        item.Click += (sender, args) =>
        {
            try { action(); }
            catch { }
        };
        menu.Items.Add(item);
    }

    private static void InvokeNoArgs(object target, string methodName)
    {
        var method = target.GetType().GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public);
        if (method != null) method.Invoke(target, null);
    }

    private static object GetProperty(object target, string propertyName)
    {
        var prop = target.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public);
        return prop == null ? null : prop.GetValue(target, null);
    }

    private static object GetIndexerValue(object target, int index)
    {
        var prop = target.GetType().GetProperties()
            .FirstOrDefault(p => p.GetIndexParameters().Length == 1 && p.GetIndexParameters()[0].ParameterType == typeof(int));
        return prop == null ? null : prop.GetValue(target, new object[] { index });
    }

    private static void SetProperty(object target, string propertyName, object value)
    {
        var prop = target.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public);
        if (prop == null || !prop.CanWrite) return;
        prop.SetValue(target, value, null);
    }

    private static void SetEnumProperty(object target, string propertyName, string enumValue)
    {
        var prop = target.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public);
        if (prop == null || !prop.CanWrite || !prop.PropertyType.IsEnum) return;
        prop.SetValue(target, Enum.Parse(prop.PropertyType, enumValue), null);
    }
}
