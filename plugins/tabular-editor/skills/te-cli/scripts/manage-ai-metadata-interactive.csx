#r "System.Drawing"

// Interactive TE3 macro for semantic model AI instructions and AI schema.
// It edits culture linguistic metadata:
//   CustomInstructions -> Copilot/Instructions/instructions.md equivalent
//   Entities            -> Copilot/schema.json equivalent
//
// Experimental utility provided as-is. It is not an official supported Tabular
// Editor feature or public scripting API.
//
// The UI is created through reflection so this script still compiles in the
// headless te CLI, where System.Windows.Forms is not available on macOS/Linux.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TabularEditor.TOMWrapper;

if (Model.Cultures.Count == 0)
{
    Model.AddTranslation("en-US");
}

var ui = FormsUi.TryCreate();
if (ui == null)
{
    Error("This interactive script requires Tabular Editor 3 Desktop with System.Windows.Forms. Use manage-ai-metadata.csx for te CLI automation.");
    return;
}

ScriptHelper.WaitFormVisible = false;

var font = new Font("Segoe UI", 10);
var monoFont = new Font("Consolas", 10);

dynamic form = ui.New("Form");
form.Text = "Semantic Model AI Metadata";
form.StartPosition = ui.Enum("FormStartPosition", "CenterScreen");
form.Width = 980;
form.Height = 720;
form.MinimumSize = new Size(820, 520);

dynamic cultureLabel = ui.New("Label");
cultureLabel.Text = "Culture";
cultureLabel.Left = 16;
cultureLabel.Top = 18;
cultureLabel.Width = 60;
cultureLabel.Font = font;

dynamic cultureCombo = ui.New("ComboBox");
cultureCombo.Left = 82;
cultureCombo.Top = 14;
cultureCombo.Width = 190;
cultureCombo.DropDownStyle = ui.Enum("ComboBoxStyle", "DropDownList");
cultureCombo.Font = font;
foreach (var culture in Model.Cultures) cultureCombo.Items.Add(culture.Name);
var preferredCulture = Model.Cultures.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.Content)) ?? Model.Cultures.First();
cultureCombo.SelectedItem = preferredCulture.Name;

dynamic targetLabel = ui.New("Label");
targetLabel.Text = "Target";
targetLabel.Left = 288;
targetLabel.Top = 18;
targetLabel.Width = 52;
targetLabel.Font = font;

dynamic targetCombo = ui.New("ComboBox");
targetCombo.Left = 346;
targetCombo.Top = 14;
targetCombo.Width = 160;
targetCombo.DropDownStyle = ui.Enum("ComboBoxStyle", "DropDownList");
targetCombo.Font = font;
targetCombo.Items.Add("Instructions");
targetCombo.Items.Add("Schema JSON");
targetCombo.SelectedIndex = 0;

dynamic statusLabel = ui.New("Label");
statusLabel.Left = 522;
statusLabel.Top = 18;
statusLabel.Width = 420;
statusLabel.Height = 24;
statusLabel.Font = font;
statusLabel.TextAlign = ContentAlignment.MiddleLeft;

dynamic editor = ui.New("TextBox");
editor.Left = 16;
editor.Top = 54;
editor.Width = 940;
editor.Height = 590;
editor.Multiline = true;
editor.ScrollBars = ui.Enum("ScrollBars", "Both");
editor.WordWrap = false;
editor.AcceptsReturn = true;
editor.AcceptsTab = true;
editor.Font = monoFont;

dynamic deleteButton = ui.New("Button");
deleteButton.Text = "Delete";
deleteButton.Left = 676;
deleteButton.Top = 652;
deleteButton.Width = 88;
deleteButton.Font = font;

dynamic saveButton = ui.New("Button");
saveButton.Text = "Save";
saveButton.Left = 772;
saveButton.Top = 652;
saveButton.Width = 88;
saveButton.Font = font;

dynamic closeButton = ui.New("Button");
closeButton.Text = "Close";
closeButton.Left = 868;
closeButton.Top = 652;
closeButton.Width = 88;
closeButton.Font = font;

form.Controls.Add(cultureLabel);
form.Controls.Add(cultureCombo);
form.Controls.Add(targetLabel);
form.Controls.Add(targetCombo);
form.Controls.Add(statusLabel);
form.Controls.Add(editor);
form.Controls.Add(deleteButton);
form.Controls.Add(saveButton);
form.Controls.Add(closeButton);

Func<Culture> selectedCulture = () => Model.Cultures[(string)cultureCombo.SelectedItem];
Func<bool> editingInstructions = () => ((string)targetCombo.SelectedItem) == "Instructions";

Action refreshStatus = () =>
{
    if (editingInstructions())
    {
        var count = ((string)editor.Text).Length;
        statusLabel.Text = count + " / " + AiMetadataInteractive.InstructionsLimit + " characters";
        statusLabel.ForeColor = count > AiMetadataInteractive.InstructionsLimit ? Color.Firebrick : SystemColors.ControlText;
        saveButton.Enabled = count <= AiMetadataInteractive.InstructionsLimit;
    }
    else
    {
        statusLabel.Text = "Copilot schema JSON";
        statusLabel.ForeColor = SystemColors.ControlText;
        saveButton.Enabled = true;
    }
};

Action loadEditor = () =>
{
    var culture = selectedCulture();
    if (editingInstructions())
    {
        editor.Text = AiMetadataInteractive.GetInstructions(culture);
    }
    else
    {
        editor.Text = AiMetadataInteractive.GetSchema(culture).ToString(Formatting.Indented);
    }
    refreshStatus();
};

ui.On((object)cultureCombo, "SelectedIndexChanged", new EventHandler((sender, args) => loadEditor()));
ui.On((object)targetCombo, "SelectedIndexChanged", new EventHandler((sender, args) => loadEditor()));
ui.On((object)editor, "TextChanged", new EventHandler((sender, args) => refreshStatus()));

ui.On((object)saveButton, "Click", new EventHandler((sender, args) =>
{
    try
    {
        var culture = selectedCulture();
        var text = (string)editor.Text;
        if (editingInstructions())
        {
            if (text.Length > AiMetadataInteractive.InstructionsLimit)
            {
                statusLabel.Text = "AI instructions must be 10000 characters or fewer.";
                statusLabel.ForeColor = Color.Firebrick;
                return;
            }
            AiMetadataInteractive.SetInstructions(culture, text);
            statusLabel.Text = "AI instructions saved to " + culture.Name + ".";
        }
        else
        {
            var schema = JObject.Parse(text);
            AiMetadataInteractive.SetSchema(culture, schema);
            editor.Text = AiMetadataInteractive.GetSchema(culture).ToString(Formatting.Indented);
            statusLabel.Text = "AI schema saved to " + culture.Name + ".";
        }
    }
    catch (Exception ex)
    {
        statusLabel.Text = ex.Message;
        statusLabel.ForeColor = Color.Firebrick;
    }
}));

ui.On((object)deleteButton, "Click", new EventHandler((sender, args) =>
{
    if (editingInstructions()) AiMetadataInteractive.DeleteInstructions(selectedCulture());
    else AiMetadataInteractive.DeleteSchema(selectedCulture());
    loadEditor();
}));

ui.On((object)closeButton, "Click", new EventHandler((sender, args) => form.Close()));

loadEditor();
form.ShowDialog();

public sealed class FormsUi
{
    private readonly Assembly _forms;

    private FormsUi(Assembly forms)
    {
        _forms = forms;
    }

    public static FormsUi TryCreate()
    {
        var forms = AppDomain.CurrentDomain.GetAssemblies()
            .FirstOrDefault(a => a.GetName().Name == "System.Windows.Forms");
        if (forms == null)
        {
            try
            {
                forms = Assembly.Load("System.Windows.Forms");
            }
            catch
            {
                return null;
            }
        }
        return new FormsUi(forms);
    }

    public dynamic New(string typeName)
    {
        var type = _forms.GetType("System.Windows.Forms." + typeName, true);
        return Activator.CreateInstance(type);
    }

    public object Enum(string typeName, string value)
    {
        var type = _forms.GetType("System.Windows.Forms." + typeName, true);
        return System.Enum.Parse(type, value);
    }

    public void On(object target, string eventName, EventHandler handler)
    {
        target.GetType().GetEvent(eventName).AddEventHandler(target, handler);
    }
}

public static class AiMetadataInteractive
{
    public const int InstructionsLimit = 10000;

    public static string GetInstructions(Culture culture)
    {
        var payload = GetPayload(culture, false);
        return (string)payload["CustomInstructions"] ?? "";
    }

    public static void SetInstructions(Culture culture, string instructions)
    {
        var payload = GetPayload(culture, true);
        payload["CustomInstructions"] = NormalizeInstructions(instructions);
        SavePayload(culture, payload);
    }

    public static void DeleteInstructions(Culture culture)
    {
        if (string.IsNullOrWhiteSpace(culture.Content)) return;
        var payload = GetPayload(culture, false);
        if (!payload.Remove("CustomInstructions")) return;
        SavePayload(culture, payload);
    }

    public static JObject GetSchema(Culture culture)
    {
        var payload = GetPayload(culture, false);
        return SchemaFromEntities(payload["Entities"] as JObject);
    }

    public static void SetSchema(Culture culture, JObject schema)
    {
        var payload = GetPayload(culture, true);
        payload["Entities"] = EntitiesFromSchema(schema);
        SavePayload(culture, payload);
    }

    public static void DeleteSchema(Culture culture)
    {
        if (string.IsNullOrWhiteSpace(culture.Content)) return;
        var payload = GetPayload(culture, false);
        if (!payload.Remove("Entities")) return;
        SavePayload(culture, payload);
    }

    private static string NormalizeInstructions(string text)
    {
        return (text ?? "").Replace("\r\n", "\n").Replace("\r", "\n");
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
}
