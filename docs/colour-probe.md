# Colour Probe Branch

This branch temporarily remaps a few TableTest syntax elements to broader
theme-recognised scope families so their colours are easier to compare in your
current VS Code theme.

Use `Developer: Inspect Editor Tokens and Scopes` on a token you like and note
the winning scope family.

Temporary probe mapping on this branch:

- Plain unquoted table text:
  - current branch scope: `string.unquoted.tabletest`
- Header cells:
  - existing scopes:
    - ordinary headers: `entity.name.column.tabletest entity.name.type.tabletest.probe.header`
  - question-mark headers: `markup.inserted.tabletest.probe.question-header`
- Pipe separators:
  - current branch scope: `punctuation.separator.pipe.tabletest`
- Map keys:
  - current branch scopes:
    - quoted keys: outer `string.quoted.*.tabletest`, content `keyword.control.tabletest`
    - unquoted keys: `keyword.control.tabletest`
- Commas and map colons:
  - current branch scopes:
    - commas: `constant.numeric.tabletest.separator`
    - map colons: `constant.numeric.tabletest.separator`
- Collection brackets and braces:
  - existing scopes: `punctuation.section.brackets.*.tabletest`,
    `punctuation.section.braces.*.tabletest`
  - added probe family: `entity.name.type.tabletest.probe`
- Ordinary quoted strings:
  - current branch scope: `string.quoted.double/single.tabletest`
- String quotes:
  - current branch scope: `constant.numeric.tabletest.quote`
  - intended effect: same family as comma and map-colon separators
- Comments:
  - current branch scope: `comment.line.double-slash.tabletest`

Additionally, this branch disables bracket-pair colourization for standalone
`.table` files via
[`language-configuration.tabletest.json`](../language-configuration.tabletest.json).
That lets ordinary cell text keep its own colour even when it contains `[]`,
`{}`, or `()`.

This only affects standalone `.table` files. Injected Java and Kotlin tables
still inherit bracket-pair colourization behaviour from the host language.

Header bolding is applied by editor decorations for `.table`, Java, and Kotlin
TableTest headers, so both ordinary and question-mark headers stay bold even
when the active theme does not assign a bold font style to those token families.
