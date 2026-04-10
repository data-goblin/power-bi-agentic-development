#r "System.Drawing"

// TE3 Desktop GUI editor for semantic model AI instructions.
// Uses Model.Cultures["en-US"].Content -> CustomInstructions.
//
// Experimental utility provided as-is. It edits culture linguistic metadata
// directly and is not an official supported Tabular Editor feature or public
// scripting API.

using System;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TabularEditor.TOMWrapper;

try
{
    AiInstructionsEditor.Run(Model);
}
catch (Exception ex)
{
    MessageBox.Show(AiInstructionsEditor.RootMessage(ex), "Semantic Model AI Instructions");
}

public static class AiInstructionsEditor
{
    private const string DefaultCultureName = "en-US";
    private const int InstructionsLimit = 10000;

    public static void Run(TabularEditor.TOMWrapper.Model model)
    {
        ScriptHelper.WaitFormVisible = false;

        if (model == null)
        {
            MessageBox.Show("Open or connect to a model before running this script.", "Semantic Model AI Instructions");
            return;
        }

        string startupWarning;
        var culture = EnsureCulture(model, DefaultCultureName, out startupWarning);
        if (culture == null)
        {
            MessageBox.Show("Could not find or create the en-US culture.", "Semantic Model AI Instructions");
            return;
        }

        using (var form = new Form())
        using (var editor = ScriptTextEditor.Create(true))
        {
            form.Text = "Semantic Model AI Instructions";
            form.StartPosition = FormStartPosition.CenterScreen;
            form.AutoScaleMode = AutoScaleMode.Dpi;
            form.Width = 980;
            form.Height = 760;
            form.MinimumSize = new Size(760, 520);

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

            var editorPanel = new Panel
            {
                Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(0)
            };
            editorPanel.Controls.Add(editor.Control);

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
                Margin = new Padding(0, 0, 8, 0)
            };

            var wrapButton = NewFooterButton("Wrap", font);
            var reloadButton = NewFooterButton("Reload", font);
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
            buttonStrip.Controls.Add(wrapButton);
            buttonStrip.Controls.Add(reloadButton);
            buttonStrip.Controls.Add(saveButton);
            buttonStrip.Controls.Add(closeButton);

            bottom.Controls.Add(status, 0, 0);
            bottom.Controls.Add(buttonStrip, 1, 0);

            layout.Controls.Add(header, 0, 0);
            layout.Controls.Add(editorPanel, 0, 1);
            layout.Controls.Add(bottom, 0, 2);
            form.Controls.Add(layout);
            form.CancelButton = closeButton;

            Action refreshStatus = () =>
            {
                var count = NormalizeForStorage(editor.Text).Length;
                status.Text = count + " / " + InstructionsLimit + " characters" +
                    (string.IsNullOrWhiteSpace(startupWarning) ? "" : "    " + startupWarning);
                status.ForeColor = count > InstructionsLimit ? Color.Firebrick :
                    string.IsNullOrWhiteSpace(startupWarning) ? SystemColors.ControlText : Color.DarkGoldenrod;
                saveButton.Enabled = count <= InstructionsLimit;
            };

            Action load = () =>
            {
                try
                {
                    editor.Text = NormalizeForEditor(GetInstructions(culture));
                    editor.SelectStart();
                    refreshStatus();
                }
                catch (Exception ex)
                {
                    status.Text = RootMessage(ex);
                    status.ForeColor = Color.Firebrick;
                }
            };

            editor.TextChanged += (sender, args) => refreshStatus();
            wrapButton.Click += (sender, args) => editor.WordWrap = !editor.WordWrap;
            reloadButton.Click += (sender, args) => load();
            saveButton.Click += (sender, args) =>
            {
                try
                {
                    var text = NormalizeForStorage(editor.Text);
                    if (text.Length > InstructionsLimit)
                    {
                        status.Text = "AI instructions must be 10000 characters or fewer.";
                        status.ForeColor = Color.Firebrick;
                        return;
                    }

                    SetInstructions(culture, text);
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

            load();
            form.Shown += (sender, args) => editor.Focus();
            form.ShowDialog();
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

    private static string GetInstructions(Culture culture)
    {
        var payload = GetPayload(culture, false);
        return (string)payload["CustomInstructions"] ?? "";
    }

    private static void SetInstructions(Culture culture, string instructions)
    {
        var payload = GetPayload(culture, true);
        payload["CustomInstructions"] = instructions ?? "";
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

    private static string NormalizeForEditor(string text)
    {
        return (text ?? "").Replace("\r\n", "\n").Replace("\r", "\n").Replace("\n", Environment.NewLine);
    }

    private static string NormalizeForStorage(string text)
    {
        return (text ?? "").Replace("\r\n", "\n").Replace("\r", "\n");
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
    private readonly TextBox textBox;

    public Control Control { get; private set; }
    public event EventHandler TextChanged;

    private ScriptTextEditor(TextBox textBox)
    {
        this.textBox = textBox;
        Control = textBox;
        Control.TextChanged += (sender, args) => TextChanged?.Invoke(this, EventArgs.Empty);
    }

    public static ScriptTextEditor Create(bool wordWrap)
    {
        var textBox = new TextBox
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
        return new ScriptTextEditor(textBox);
    }

    public string Text
    {
        get { return Control.Text ?? ""; }
        set { Control.Text = value ?? ""; }
    }

    public bool WordWrap
    {
        get { return textBox.WordWrap; }
        set
        {
            textBox.WordWrap = value;
        }
    }

    public void Focus()
    {
        Control.Focus();
    }

    public void SelectStart()
    {
        textBox.SelectionStart = 0;
        textBox.SelectionLength = 0;
    }

    public void Dispose()
    {
        Control?.Dispose();
    }
}
