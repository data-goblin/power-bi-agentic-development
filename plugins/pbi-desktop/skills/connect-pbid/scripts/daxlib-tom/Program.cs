#nullable enable
// daxlib-tom: TOM helper for daxlib package operations against PBI Desktop.
// Called by the daxlib Rust CLI for model operations.
//
// Usage:
//   daxlib-tom add <port> <tmdl-path> [--fn name,name]
//   daxlib-tom update <port> <package-id> <tmdl-path>
//   daxlib-tom remove <port> <package-id> [--fn name,name]
//   daxlib-tom installed <port>
//   daxlib-tom upgrade-cl <port> <target-cl>

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.AnalysisServices.Tabular;


// #region Types

class ParsedFunction
{
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Expression { get; set; } = "";
    public Dictionary<string, string> Annotations { get; set; } = new();
}

// #endregion


// #region TMDL Parser

static class TmdlParser
{
    /// <summary>
    /// Parses a functions.tmdl file into individual function definitions.
    /// Extracts name, description (from /// comments), expression body,
    /// and annotations (DAXLIB_PackageId, DAXLIB_PackageVersion, etc.).
    /// </summary>
    public static List<ParsedFunction> Parse(string tmdl)
    {
        var functions = new List<ParsedFunction>();
        var lines = tmdl.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
        int i = 0;

        while (i < lines.Length)
        {
            string trimmed = lines[i].TrimStart();
            if (!trimmed.StartsWith("function '")) { i++; continue; }

            // Extract name from: function 'Package.Name' =
            int q1 = trimmed.IndexOf('\'') + 1;
            int q2 = trimmed.IndexOf('\'', q1);
            if (q2 < 0) { i++; continue; }
            string name = trimmed.Substring(q1, q2 - q1);

            // Collect description from preceding /// lines
            string desc = "";
            int j = i - 1;
            while (j >= 0 && lines[j].TrimStart().StartsWith("///"))
            {
                string dl = lines[j].TrimStart().TrimStart('/').Trim();
                if (!dl.StartsWith("@") && dl.Length > 0) desc = dl;
                j--;
            }

            // Collect expression and annotations
            i++;
            var exprLines = new List<string>();
            var annotations = new Dictionary<string, string>();

            while (i < lines.Length)
            {
                string el = lines[i];
                string et = el.TrimStart();

                // Annotation at one-tab indent
                if (el.StartsWith("\tannotation ") && !el.StartsWith("\t\t"))
                {
                    int eqPos = el.IndexOf('=');
                    if (eqPos > 0)
                    {
                        string aKey = el.Substring("\tannotation ".Length, eqPos - "\tannotation ".Length).Trim();
                        string aVal = el.Substring(eqPos + 1).Trim();
                        annotations[aKey] = aVal;
                    }
                    i++;
                    continue;
                }

                // Next function boundary
                if (et.StartsWith("function '") || (et.StartsWith("///") && !el.StartsWith("\t\t")))
                {
                    bool isNext = et.StartsWith("function '");
                    if (!isNext)
                    {
                        int k = i;
                        while (k < lines.Length && lines[k].TrimStart().StartsWith("///")) k++;
                        isNext = k < lines.Length && lines[k].TrimStart().StartsWith("function '");
                    }
                    if (isNext) break;
                }

                // Strip up to 2 leading tabs from expression body
                string stripped = el;
                if (stripped.StartsWith("\t\t")) stripped = stripped.Substring(2);
                else if (stripped.StartsWith("\t")) stripped = stripped.Substring(1);
                exprLines.Add(stripped);
                i++;
            }

            // Trim trailing blank lines
            while (exprLines.Count > 0 && string.IsNullOrWhiteSpace(exprLines[^1]))
                exprLines.RemoveAt(exprLines.Count - 1);

            functions.Add(new ParsedFunction
            {
                Name = name,
                Description = desc,
                Expression = string.Join("\n", exprLines),
                Annotations = annotations
            });
        }

        return functions;
    }


    /// <summary>
    /// Filters a list of functions to only those matching the given names.
    /// Matching is case-insensitive; supports both full names and suffix
    /// matches (e.g. "Element.Rect" matches "DaxLib.SVG.Element.Rect").
    /// </summary>
    public static List<ParsedFunction> Filter(List<ParsedFunction> functions, string[] names)
    {
        return functions.Where(f =>
            names.Any(n =>
                f.Name.Equals(n, StringComparison.OrdinalIgnoreCase) ||
                f.Name.EndsWith("." + n, StringComparison.OrdinalIgnoreCase)
            )
        ).ToList();
    }
}

// #endregion


// #region TOM Operations

static class TomOps
{
    /// <summary>
    /// Connects to PBI Desktop's local Analysis Services on the given port.
    /// Returns (server, database, model). Exits on failure.
    /// </summary>
    public static (Server server, Database db, Model model) Connect(int port)
    {
        var server = new Server();
        try { server.Connect($"Data Source=localhost:{port}"); }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Failed to connect to localhost:{port}: {ex.Message}");
            Environment.Exit(1);
        }

        if (server.Databases.Count == 0)
        {
            Console.Error.WriteLine("No databases found. Is a model loaded in PBI Desktop?");
            server.Disconnect();
            Environment.Exit(1);
        }

        var db = server.Databases[0];
        return (server, db, db.Model);
    }


    /// <summary>
    /// Adds parsed functions to the model. Skips existing names.
    /// Does not call SaveChanges.
    /// </summary>
    public static int AddFunctions(Model model, List<ParsedFunction> functions)
    {
        int added = 0;
        foreach (var pf in functions)
        {
            if (model.Functions.ContainsName(pf.Name))
            {
                Console.WriteLine($"  SKIP: [{pf.Name}] (exists)");
                continue;
            }

            var func = new Function { Name = pf.Name, Expression = pf.Expression, Description = pf.Description };
            foreach (var kv in pf.Annotations)
                func.Annotations.Add(new Annotation { Name = kv.Key, Value = kv.Value });

            model.Functions.Add(func);
            Console.WriteLine($"  ADD: [{pf.Name}]");
            added++;
        }
        return added;
    }


    /// <summary>
    /// Removes functions by package ID annotation. Returns count removed.
    /// Does not call SaveChanges.
    /// </summary>
    public static int RemoveByPackage(Model model, string packageId)
    {
        var toRemove = new List<string>();
        foreach (Function f in model.Functions)
        {
            if (f.Annotations.ContainsName("DAXLIB_PackageId") &&
                f.Annotations["DAXLIB_PackageId"].Value == packageId)
                toRemove.Add(f.Name);
        }

        foreach (var name in toRemove)
        {
            model.Functions.Remove(model.Functions[name]);
            Console.WriteLine($"  DEL: [{name}]");
        }
        return toRemove.Count;
    }


    /// <summary>
    /// Removes specific functions by name. Tries exact match, then
    /// packageId.name prefix match. Does not call SaveChanges.
    /// </summary>
    public static int RemoveByName(Model model, string packageId, string[] names)
    {
        int removed = 0;
        foreach (var name in names)
        {
            Function? func = null;
            if (model.Functions.ContainsName(name))
                func = model.Functions[name];
            else if (model.Functions.ContainsName(packageId + "." + name))
                func = model.Functions[packageId + "." + name];

            if (func != null)
            {
                model.Functions.Remove(func);
                Console.WriteLine($"  DEL: [{func.Name}]");
                removed++;
            }
            else
            {
                Console.WriteLine($"  NOT FOUND: [{name}]");
            }
        }
        return removed;
    }
}

// #endregion


// #region Commands

static class Commands
{
    public static void Add(int port, string tmdlPath, string[]? fnFilter)
    {
        var (server, db, model) = TomOps.Connect(port);
        Console.WriteLine($"Database: {db.Name} (CL {db.CompatibilityLevel})");

        if (db.CompatibilityLevel < 1702)
        {
            Console.WriteLine($"Upgrading CL {db.CompatibilityLevel} -> 1702...");
            db.CompatibilityLevel = 1702;
            db.Update(Microsoft.AnalysisServices.UpdateOptions.ExpandFull);
        }

        var tmdl = File.ReadAllText(tmdlPath);
        var functions = TmdlParser.Parse(tmdl);

        if (fnFilter != null && fnFilter.Length > 0)
            functions = TmdlParser.Filter(functions, fnFilter);

        if (functions.Count == 0)
        {
            Console.Error.WriteLine("No matching functions found.");
            server.Disconnect();
            Environment.Exit(1);
        }

        Console.WriteLine($"Installing {functions.Count} function(s)...");
        int added = TomOps.AddFunctions(model, functions);

        if (added > 0)
        {
            model.SaveChanges();
            Console.WriteLine($"Saved. {added} function(s) installed. Total: {model.Functions.Count}");
        }
        else
        {
            Console.WriteLine("No new functions to install.");
        }

        server.Disconnect();
    }


    public static void Update(int port, string packageId, string tmdlPath)
    {
        var (server, db, model) = TomOps.Connect(port);
        Console.WriteLine($"Database: {db.Name} (CL {db.CompatibilityLevel})");

        if (db.CompatibilityLevel < 1702)
        {
            Console.WriteLine($"Upgrading CL {db.CompatibilityLevel} -> 1702...");
            db.CompatibilityLevel = 1702;
            db.Update(Microsoft.AnalysisServices.UpdateOptions.ExpandFull);
        }

        // Remove old
        int removed = TomOps.RemoveByPackage(model, packageId);
        if (removed > 0)
            Console.WriteLine($"Removed {removed} existing function(s) for {packageId}");

        // Add new
        var tmdl = File.ReadAllText(tmdlPath);
        var functions = TmdlParser.Parse(tmdl);
        Console.WriteLine($"Installing {functions.Count} function(s)...");
        int added = TomOps.AddFunctions(model, functions);

        model.SaveChanges();
        Console.WriteLine($"Saved. {added} installed, {removed} removed. Total: {model.Functions.Count}");
        server.Disconnect();
    }


    public static void Remove(int port, string packageId, string[]? fnFilter)
    {
        var (server, _, model) = TomOps.Connect(port);

        int removed;
        if (fnFilter != null && fnFilter.Length > 0)
            removed = TomOps.RemoveByName(model, packageId, fnFilter);
        else
            removed = TomOps.RemoveByPackage(model, packageId);

        if (removed > 0)
        {
            model.SaveChanges();
            Console.WriteLine($"Removed {removed} function(s). Total: {model.Functions.Count}");
        }
        else
        {
            Console.WriteLine("No matching functions found.");
        }

        server.Disconnect();
    }


    public static void Installed(int port)
    {
        var (server, db, model) = TomOps.Connect(port);
        Console.WriteLine($"Database: {db.Name} (CL {db.CompatibilityLevel})");
        Console.WriteLine();

        var packages = new Dictionary<string, (string version, List<string> fns)>();

        foreach (Function f in model.Functions)
        {
            string pkgId = "", pkgVer = "";
            if (f.Annotations.ContainsName("DAXLIB_PackageId"))
                pkgId = f.Annotations["DAXLIB_PackageId"].Value;
            if (f.Annotations.ContainsName("DAXLIB_PackageVersion"))
                pkgVer = f.Annotations["DAXLIB_PackageVersion"].Value;

            if (string.IsNullOrEmpty(pkgId)) pkgId = "(no package)";

            if (!packages.ContainsKey(pkgId))
                packages[pkgId] = (pkgVer, new List<string>());
            packages[pkgId].fns.Add(f.Name);
        }

        if (packages.Count == 0)
        {
            Console.WriteLine("No daxlib packages installed.");
        }
        else
        {
            foreach (var kv in packages.OrderBy(p => p.Key))
            {
                Console.WriteLine($"{kv.Key}  v{kv.Value.version}  ({kv.Value.fns.Count} functions)");
                foreach (var fn in kv.Value.fns.OrderBy(n => n))
                    Console.WriteLine($"  {fn}");
                Console.WriteLine();
            }
        }

        server.Disconnect();
    }


    public static void UpgradeCL(int port, int targetCL)
    {
        var (server, db, _) = TomOps.Connect(port);
        Console.WriteLine($"Current CL: {db.CompatibilityLevel}");

        if (db.CompatibilityLevel >= targetCL)
        {
            Console.WriteLine($"Already at CL {db.CompatibilityLevel}; no upgrade needed.");
        }
        else
        {
            db.CompatibilityLevel = targetCL;
            db.Update(Microsoft.AnalysisServices.UpdateOptions.ExpandFull);
            Console.WriteLine($"Upgraded to CL {db.CompatibilityLevel}");
        }

        server.Disconnect();
    }
}

// #endregion


// #region Main

class Program
{
    static void Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("daxlib-tom: TOM helper for daxlib operations");
            Console.Error.WriteLine();
            Console.Error.WriteLine("Usage:");
            Console.Error.WriteLine("  daxlib-tom add <port> <tmdl-path> [--fn name,name]");
            Console.Error.WriteLine("  daxlib-tom update <port> <package-id> <tmdl-path>");
            Console.Error.WriteLine("  daxlib-tom remove <port> <package-id> [--fn name,name]");
            Console.Error.WriteLine("  daxlib-tom installed <port>");
            Console.Error.WriteLine("  daxlib-tom upgrade-cl <port> <target-cl>");
            Environment.Exit(1);
        }

        string command = args[0];
        int port = int.Parse(args[1]);

        // Parse --fn flag and collect positional args (skipping flag pairs)
        string[]? fnFilter = null;
        var positional = new List<string>();
        for (int i = 2; i < args.Length; i++)
        {
            if (args[i] == "--fn" && i + 1 < args.Length)
            {
                fnFilter = args[i + 1].Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim()).ToArray();
                i++; // skip the value
            }
            else
            {
                positional.Add(args[i]);
            }
        }

        switch (command)
        {
            case "add":
                if (positional.Count < 1) { Console.Error.WriteLine("add requires <port> <tmdl-path>"); Environment.Exit(1); }
                Commands.Add(port, positional[0], fnFilter);
                break;

            case "update":
                if (positional.Count < 2) { Console.Error.WriteLine("update requires <port> <package-id> <tmdl-path>"); Environment.Exit(1); }
                Commands.Update(port, positional[0], positional[1]);
                break;

            case "remove":
                if (positional.Count < 1) { Console.Error.WriteLine("remove requires <port> <package-id>"); Environment.Exit(1); }
                Commands.Remove(port, positional[0], fnFilter);
                break;

            case "installed":
                Commands.Installed(port);
                break;

            case "upgrade-cl":
                if (args.Length < 3) { Console.Error.WriteLine("upgrade-cl requires <port> <target-cl>"); Environment.Exit(1); }
                Commands.UpgradeCL(port, int.Parse(args[2]));
                break;

            default:
                Console.Error.WriteLine($"Unknown command: {command}");
                Environment.Exit(1);
                break;
        }
    }
}

// #endregion
