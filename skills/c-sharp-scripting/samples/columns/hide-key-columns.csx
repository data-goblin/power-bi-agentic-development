// Hide all key/ID columns and disable summarization

var count = 0;

foreach(var c in Model.AllColumns) {
    if(c.Name.EndsWith("Key") || c.Name.EndsWith("ID") || c.Name.EndsWith("Id")) {
        if(!c.IsHidden) {
            c.IsHidden = true;
            c.SummarizeBy = AggregateFunction.None;
            count++;
        }
    }
}

Info("Hidden " + count + " key/ID columns");
