// Find and Replace Dialog
// A WinForms dialog for finding and replacing text in measure expressions
// Demonstrates: WinForms UI, ScriptHelper.WaitFormVisible, DialogResult pattern

#r "System.Drawing"

using System.Drawing;
using System.Text.RegularExpressions;
using System.Windows.Forms;

// Hide the 'Running Macro' spinner while form is open
ScriptHelper.WaitFormVisible = false;

// Target all measures (change to Selected.Measures for selected only)
var measures = Model.AllMeasures;

string findText = "";
string replaceText = "";

using (var form = new Form())
{
    // Form configuration
    form.Text = "Find and Replace in Measures";
    form.AutoSize = true;
    form.MinimumSize = new Size(400, 180);
    form.StartPosition = FormStartPosition.CenterScreen;
    form.AutoScaleMode = AutoScaleMode.Dpi;
    form.FormBorderStyle = FormBorderStyle.FixedDialog;
    form.MaximizeBox = false;

    var font = new Font("Segoe UI", 11);

    // Find label and textbox
    var findLabel = new Label() {
        Text = "Find:",
        Location = new Point(20, 25),
        Width = 80,
        Font = font
    };

    var findBox = new TextBox() {
        Location = new Point(110, 22),
        Width = 250,
        Font = font
    };

    // Replace label and textbox
    var replaceLabel = new Label() {
        Text = "Replace:",
        Location = new Point(20, 65),
        Width = 80,
        Font = font
    };

    var replaceBox = new TextBox() {
        Location = new Point(110, 62),
        Width = 250,
        Font = font
    };

    // Buttons
    var okButton = new Button() {
        Text = "Replace All",
        Location = new Point(110, 105),
        MinimumSize = new Size(100, 30),
        AutoSize = true,
        DialogResult = DialogResult.OK,
        Font = font
    };

    var cancelButton = new Button() {
        Text = "Cancel",
        Location = new Point(220, 105),
        MinimumSize = new Size(80, 30),
        AutoSize = true,
        DialogResult = DialogResult.Cancel,
        Font = font
    };

    // Wire up form
    form.AcceptButton = okButton;
    form.CancelButton = cancelButton;

    form.Controls.Add(findLabel);
    form.Controls.Add(findBox);
    form.Controls.Add(replaceLabel);
    form.Controls.Add(replaceBox);
    form.Controls.Add(okButton);
    form.Controls.Add(cancelButton);

    // Show dialog and process result
    if (form.ShowDialog() == DialogResult.OK)
    {
        findText = findBox.Text;
        replaceText = replaceBox.Text;

        if (string.IsNullOrEmpty(findText))
        {
            Error("Find text cannot be empty");
            return;
        }

        // Perform find and replace
        int totalReplacements = 0;
        var modifiedMeasures = new List<string>();

        foreach (var m in measures)
        {
            if (m.Expression.Contains(findText))
            {
                var pattern = Regex.Escape(findText);
                var count = Regex.Matches(m.Expression, pattern).Count;

                m.Expression = m.Expression.Replace(findText, replaceText);

                totalReplacements += count;
                modifiedMeasures.Add(m.DaxObjectName);
            }
        }

        // Report results
        if (modifiedMeasures.Any())
        {
            var report = $"Replaced {totalReplacements} occurrence(s) of '{findText}' with '{replaceText}'\n\n";
            report += "Modified measures:\n- " + string.Join("\n- ", modifiedMeasures);
            Info(report);
        }
        else
        {
            Info($"No occurrences of '{findText}' found in any measure expressions");
        }
    }
    else
    {
        Info("Find/Replace cancelled");
    }
}
