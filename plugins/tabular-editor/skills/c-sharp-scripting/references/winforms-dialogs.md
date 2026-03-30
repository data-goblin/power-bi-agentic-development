# WinForms UI Patterns

Create interactive dialogs for user input using System.Windows.Forms in Tabular Editor scripts.

## Basic Input Dialog

```csharp
#r "System.Drawing"

using System.Drawing;
using System.Windows.Forms;

// Hide the 'Running Macro' spinner
ScriptHelper.WaitFormVisible = false;

string userInput = "";

using(var form = new Form())
{
    form.Text = "Input Required";
    form.AutoSize = true;
    form.StartPosition = FormStartPosition.CenterScreen;
    form.AutoScaleMode = AutoScaleMode.Dpi;

    var font = new Font("Segoe UI", 11);

    var label = new Label() {
        Text = "Enter value:",
        Location = new Point(20, 20),
        AutoSize = true,
        Font = font
    };

    var textBox = new TextBox() {
        Location = new Point(20, 50),
        Width = 200,
        Font = font
    };

    var okButton = new Button() {
        Text = "OK",
        Location = new Point(20, 90),
        DialogResult = DialogResult.OK,
        Font = font
    };

    var cancelButton = new Button() {
        Text = "Cancel",
        Location = new Point(100, 90),
        DialogResult = DialogResult.Cancel,
        Font = font
    };

    form.AcceptButton = okButton;
    form.CancelButton = cancelButton;

    form.Controls.Add(label);
    form.Controls.Add(textBox);
    form.Controls.Add(okButton);
    form.Controls.Add(cancelButton);

    if(form.ShowDialog() == DialogResult.OK) {
        userInput = textBox.Text;
        Info("You entered: " + userInput);
    } else {
        Error("Cancelled!");
    }
}
```

## Dropdown Selection Dialog

```csharp
#r "System.Drawing"

using System.Drawing;
using System.Windows.Forms;

ScriptHelper.WaitFormVisible = false;

using(var form = new Form())
{
    form.Text = "Select Option";
    form.AutoSize = true;
    form.StartPosition = FormStartPosition.CenterScreen;

    var combo = new ComboBox() {
        Location = new Point(20, 20),
        Width = 150,
        DropDownStyle = ComboBoxStyle.DropDownList
    };
    combo.Items.AddRange(new object[] { "Option A", "Option B", "Option C" });
    combo.SelectedIndex = 0;

    var okButton = new Button() {
        Text = "OK",
        Location = new Point(20, 60),
        DialogResult = DialogResult.OK
    };

    form.Controls.Add(combo);
    form.Controls.Add(okButton);
    form.AcceptButton = okButton;

    if(form.ShowDialog() == DialogResult.OK) {
        Info("Selected: " + combo.SelectedItem.ToString());
    }
}
```
