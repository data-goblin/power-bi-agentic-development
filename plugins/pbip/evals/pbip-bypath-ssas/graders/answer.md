---
type: llm
weight: 0.5
---
PASS if the reply explains that byConnection only supports a semantic model hosted in Microsoft Fabric and that an Analysis Services model needs a byPath reference to a semantic model folder containing modelReference.json. FAIL if it simply writes a byConnection with Data Source=ssas01 and says it works.
