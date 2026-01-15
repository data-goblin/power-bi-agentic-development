// Format String Picker Dialog
// Let user choose a format string from common options and apply to selected measures
// Demonstrates: ComboBox, Selected.Measures, applying format strings

#r "System.Drawing"

using System.Drawing;
using System.Windows.Forms;

ScriptHelper.WaitFormVisible = false;

// Check if measures are selected
if (!Selected.Measures.Any())
{
    Error("Please select one or more measures first");
    return;
}

var formatStrings = new Dictionary<string, string>
{
    { "Currency ($)", "$#,0" },
    { "Currency ($ with decimals)", "$#,0.00" },
    { "Percentage", "0%" },
    { "Percentage (1 decimal)", "0.0%" },
    { "Percentage (2 decimals)", "0.00%" },
    { "Number (whole)", "#,0" },
    { "Number (1 decimal)", "#,0.0" },
    { "Number (2 decimals)", "#,0.00" },
    { "Integer", "0" },
    { "Date (Short)", "Short Date" },
    { "Date (Long)", "Long Date" }
};

using (var form = new Form())
{
    form.Text = "Select Format String";
    form.Size = new Size(350, 150);
    form.StartPosition = FormStartPosition.CenterScreen;
    form.FormBorderStyle = FormBorderStyle.FixedDialog;
    form.MaximizeBox = false;

    var font = new Font("Segoe UI", 11);

    var label = new Label() {
        Text = $"Apply format to {Selected.Measures.Count()} measure(s):",
        Location = new Point(20, 20),
        AutoSize = true,
        Font = font
    };

    var combo = new ComboBox() {
        Location = new Point(20, 50),
        Width = 290,
        DropDownStyle = ComboBoxStyle.DropDownList,
        Font = font
    };

    foreach (var item in formatStrings.Keys)
    {
        combo.Items.Add(item);
    }
    combo.SelectedIndex = 0;

    var okButton = new Button() {
        Text = "Apply",
        Location = new Point(20, 90),
        MinimumSize = new Size(80, 28),
        DialogResult = DialogResult.OK,
        Font = font
    };

    var cancelButton = new Button() {
        Text = "Cancel",
        Location = new Point(110, 90),
        MinimumSize = new Size(80, 28),
        DialogResult = DialogResult.Cancel,
        Font = font
    };

    form.AcceptButton = okButton;
    form.CancelButton = cancelButton;

    form.Controls.Add(label);
    form.Controls.Add(combo);
    form.Controls.Add(okButton);
    form.Controls.Add(cancelButton);

    if (form.ShowDialog() == DialogResult.OK)
    {
        var selectedFormat = formatStrings[combo.SelectedItem.ToString()];

        foreach (var m in Selected.Measures)
        {
            m.FormatString = selectedFormat;
        }

        Info($"Applied format '{selectedFormat}' to {Selected.Measures.Count()} measure(s)");
    }
}
