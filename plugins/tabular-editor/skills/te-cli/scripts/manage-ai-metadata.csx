// Manage semantic model AI instructions and AI schema from te script.
//
// Non-interactive usage:
//   TE_AI_ACTION=get TE_AI_TARGET=both te script -S manage-ai-metadata.csx -m ./model --output-format json
//   TE_AI_ACTION=set TE_AI_TARGET=instructions TE_AI_INPUT_FILE=./instructions.md te script -S manage-ai-metadata.csx -m ./model --save
//   TE_AI_ACTION=set TE_AI_TARGET=schema TE_AI_INPUT_FILE=./schema.json te script -S manage-ai-metadata.csx -m ./model --save
//   TE_AI_ACTION=delete TE_AI_TARGET=schema te script -S manage-ai-metadata.csx -m ./model --save
//
// Environment variables:
//   TE_AI_ACTION       list | get | set | delete. Default: get.
//   TE_AI_TARGET       instructions | schema | both. Default: both for get/list, required for set/delete.
//   TE_AI_CULTURE      Culture name to use. Default: first culture with linguistic metadata, then first culture, then en-US on set.
//   TE_AI_INPUT_FILE   File to read for set.
//   TE_AI_INPUT        Inline payload to use for set when TE_AI_INPUT_FILE is not set.
//   TE_AI_OUTPUT_FILE  Optional file path for JSON/text output.
//   TE_AI_ALLOW_OVER_LIMIT=true permits instructions longer than 10000 characters.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TabularEditor.TOMWrapper;

var action = AiMetadata.Env("TE_AI_ACTION", "get").Trim().ToLowerInvariant();
var target = AiMetadata.Env("TE_AI_TARGET", action == "set" || action == "delete" ? "" : "both").Trim().ToLowerInvariant();
var cultureName = AiMetadata.Env("TE_AI_CULTURE", "").Trim();
var outputFile = AiMetadata.Env("TE_AI_OUTPUT_FILE", "").Trim();

// Write a machine-readable error envelope (stdout / TE_AI_OUTPUT_FILE) before
// reporting the error, so failures never leave a stale success payload behind.
// The envelope write must never mask the original error with its own exception
// (e.g. an unwritable TE_AI_OUTPUT_FILE), so it is best-effort.
void Fail(string message)
{
    try
    {
        AiMetadata.WriteResult(new JObject
        {
            ["error"] = message,
            ["action"] = action,
            ["target"] = target,
            ["culture"] = cultureName
        }, outputFile);
    }
    catch (Exception writeEx)
    {
        Error("Failed to write error envelope: " + writeEx.Message);
    }
    Error(message);
}

if (action != "list" && action != "get" && action != "set" && action != "delete")
{
    Fail("TE_AI_ACTION must be 'list', 'get', 'set', or 'delete'.");
    return;
}

try
{
    if (action == "list")
    {
        AiMetadata.WriteResult(AiMetadata.ListCultures(Model), outputFile);
        return;
    }

    if (target != "instructions" && target != "schema" && target != "both")
    {
        Fail("TE_AI_TARGET must be 'instructions', 'schema', or 'both'.");
        return;
    }

    var culture = AiMetadata.FindCulture(Model, cultureName, action == "set");
    if (culture == null)
    {
        Fail("No culture is available on this model. Add a culture before managing AI metadata.");
        return;
    }

    if (action == "get")
    {
        var result = AiMetadata.Read(Model, culture, target);
        AiMetadata.WriteResult(result, outputFile);
        return;
    }

    if (action == "set")
    {
        var input = AiMetadata.ReadInput();
        if (target == "instructions")
        {
            if (input.Length > AiMetadata.InstructionsLimit && !AiMetadata.AllowOverLimit())
            {
                Fail("AI instructions are " + input.Length + " characters. Limit is " + AiMetadata.InstructionsLimit + ". Set TE_AI_ALLOW_OVER_LIMIT=true to override.");
                return;
            }
            AiMetadata.SetInstructions(culture, input);
        }
        else if (target == "schema")
        {
            var schema = AiMetadata.ResolveSchemaInput(JObject.Parse(input));
            if (schema == null)
            {
                Fail("No tables found in input. Expected {\"tables\": [...]} or the get output envelope.");
                return;
            }
            AiMetadata.SetSchema(culture, schema);
        }
        else
        {
            Fail("TE_AI_TARGET=both is not valid for set. Set instructions and schema in separate calls.");
            return;
        }

        AiMetadata.WriteResult(AiMetadata.Read(Model, culture, target), outputFile);
        return;
    }

    if (action == "delete")
    {
        if (target == "instructions" || target == "both") AiMetadata.DeleteInstructions(culture);
        if (target == "schema" || target == "both") AiMetadata.DeleteSchema(culture);
        AiMetadata.WriteResult(AiMetadata.Read(Model, culture, target), outputFile);
        return;
    }
}
catch (Exception ex)
{
    Fail(ex.Message);
}

public static class AiMetadata
{
    public const int InstructionsLimit = 10000;

    public static string Env(string name, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrWhiteSpace(value) ? fallback : value;
    }

    public static bool AllowOverLimit()
    {
        return string.Equals(Env("TE_AI_ALLOW_OVER_LIMIT", ""), "true", StringComparison.OrdinalIgnoreCase);
    }

    public static string ReadInput()
    {
        var inputFile = Env("TE_AI_INPUT_FILE", "").Trim();
        if (!string.IsNullOrWhiteSpace(inputFile)) return File.ReadAllText(inputFile);

        var input = Environment.GetEnvironmentVariable("TE_AI_INPUT");
        if (input != null) return input;

        throw new InvalidOperationException("Set TE_AI_INPUT_FILE or TE_AI_INPUT for TE_AI_ACTION=set.");
    }

    public static void WriteResult(JToken result, string outputFile)
    {
        var text = result.ToString(Formatting.Indented);
        if (!string.IsNullOrWhiteSpace(outputFile))
        {
            var dir = Path.GetDirectoryName(Path.GetFullPath(outputFile));
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(outputFile, text + Environment.NewLine);
            Console.WriteLine("Wrote " + outputFile);
            return;
        }

        Console.WriteLine(text);
    }

    public static Culture FindCulture(TabularEditor.TOMWrapper.Model model, string cultureName, bool createIfMissing)
    {
        if (!string.IsNullOrWhiteSpace(cultureName))
        {
            if (!model.Cultures.Contains(cultureName))
            {
                if (createIfMissing) return model.AddTranslation(cultureName);
                throw new InvalidOperationException("Culture '" + cultureName + "' was not found.");
            }
            return model.Cultures[cultureName];
        }

        var withMetadata = model.Cultures.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.Content));
        if (withMetadata != null) return withMetadata;
        var firstCulture = model.Cultures.FirstOrDefault();
        if (firstCulture != null) return firstCulture;
        return createIfMissing ? model.AddTranslation("en-US") : null;
    }

    public static JArray ListCultures(TabularEditor.TOMWrapper.Model model)
    {
        var cultures = new JArray();
        foreach (var culture in model.Cultures)
        {
            var payload = TryParsePayload(culture);
            var entities = payload?["Entities"] as JObject;
            cultures.Add(new JObject
            {
                ["name"] = culture.Name,
                ["hasLinguisticMetadata"] = !string.IsNullOrWhiteSpace(culture.Content),
                ["hasAiInstructions"] = payload?["CustomInstructions"] != null,
                ["schemaObjectCount"] = entities == null ? 0 : entities.Properties().Count()
            });
        }
        return cultures;
    }

    public static JObject Read(TabularEditor.TOMWrapper.Model model, Culture culture, string target)
    {
        var payload = GetPayload(culture, false);
        var result = new JObject
        {
            ["model"] = model.Name,
            ["culture"] = culture.Name,
            ["storage"] = "culture.linguisticMetadata",
            ["copilotTooling"] = HasCopilotTooling(model)
        };

        if (target == "instructions" || target == "both")
        {
            var instructions = (string)payload["CustomInstructions"];
            result["aiInstructions"] = new JObject
            {
                ["exists"] = instructions != null,
                ["length"] = instructions == null ? 0 : instructions.Length,
                ["limit"] = InstructionsLimit,
                ["text"] = instructions ?? ""
            };
        }

        if (target == "schema" || target == "both")
        {
            var schema = SchemaFromEntities(payload["Entities"] as JObject);
            result["aiSchema"] = schema;
            result["schemaObjectCount"] = CountSchemaObjects(schema);
        }

        return result;
    }

    public static void SetInstructions(Culture culture, string instructions)
    {
        var payload = GetPayload(culture, true);
        payload["CustomInstructions"] = instructions ?? "";
        SavePayload(culture, payload);
    }

    public static void DeleteInstructions(Culture culture)
    {
        if (string.IsNullOrWhiteSpace(culture.Content)) return;
        var payload = GetPayload(culture, false);
        if (!payload.Remove("CustomInstructions")) return;
        SavePayload(culture, payload);
    }

    public static JObject ResolveSchemaInput(JObject input)
    {
        if (input == null) return null;
        if (HasTablesCollection(input)) return input;
        if (input["aiSchema"] is JObject envelope && HasTablesCollection(envelope)) return envelope;
        return null;
    }

    private static bool HasTablesCollection(JObject candidate)
    {
        // A JSON null value parses to a JValue, not a reference null, so a
        // bare null check would let {"tables": null} through and wipe Entities.
        return candidate["tables"] is JContainer || candidate["Tables"] is JContainer;
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

    private static bool HasCopilotTooling(TabularEditor.TOMWrapper.Model model)
    {
        var value = model.GetAnnotation("PBI_ProTooling");
        return value != null && value.IndexOf("CopilotTooling", StringComparison.OrdinalIgnoreCase) >= 0;
    }

    private static JObject TryParsePayload(Culture culture)
    {
        if (string.IsNullOrWhiteSpace(culture.Content)) return null;
        try
        {
            return JObject.Parse(culture.Content);
        }
        catch
        {
            return null;
        }
    }

    private static JObject GetPayload(Culture culture, bool create)
    {
        if (!string.IsNullOrWhiteSpace(culture.Content))
        {
            try
            {
                return JObject.Parse(culture.Content);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Culture '" + culture.Name + "' linguistic metadata is not valid JSON: " + ex.Message);
            }
        }

        if (!create)
        {
            return new JObject();
        }

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

        if (entities == null)
        {
            return new JObject { ["tables"] = orderedTables };
        }

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

    private static int CountSchemaObjects(JObject schema)
    {
        var count = 0;
        foreach (var table in (schema["tables"] as JArray ?? new JArray()).OfType<JObject>())
        {
            count++;
            count += (table["columns"] as JArray ?? new JArray()).Count;
            count += (table["measures"] as JArray ?? new JArray()).Count;
            foreach (var hierarchy in (table["hierarchies"] as JArray ?? new JArray()).OfType<JObject>())
            {
                count++;
                count += (hierarchy["levels"] as JArray ?? new JArray()).Count;
            }
        }
        return count;
    }
}
