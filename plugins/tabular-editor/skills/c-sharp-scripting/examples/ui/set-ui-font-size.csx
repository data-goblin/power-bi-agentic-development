// Title: Set TE3 UI Font Size
// Author: Kurt Buhler
// Description: Sets the Tabular Editor 3 UI font for the current session through DevExpress WindowsFormsSettings and refreshes open windows. Code editors keep their own font settings.
// Usage: TE3 desktop only (C# Script window or macro); not for te CLI
// Non-interactive: Yes (edit fontSize below)

using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;

float fontSize = 11f;
string fontName = "Segoe UI";

var font = new Font(fontName, fontSize);

var settings = AppDomain.CurrentDomain.GetAssemblies()
    .Select(a => a.GetType("DevExpress.XtraEditors.WindowsFormsSettings", false))
    .FirstOrDefault(t => t != null);

if (settings == null)
{
    Error("DevExpress WindowsFormsSettings not found in this TE3 process");
    return;
}

foreach (var name in new[] { "DefaultFont", "DefaultMenuFont" })
{
    var prop = settings.GetProperty(name, BindingFlags.Public | BindingFlags.Static);
    if (prop != null && prop.CanWrite) prop.SetValue(null, font);
}

foreach (Form f in Application.OpenForms)
{
    f.Font = font;
    f.PerformLayout();
    f.Refresh();
}

Info("TE3 UI font set to " + fontName + " " + fontSize + " pt for this session");
