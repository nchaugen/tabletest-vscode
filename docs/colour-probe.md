# Colour Probe Branch

This branch temporarily remaps a few TableTest syntax elements to broader
theme-recognised scope families so their colours are easier to compare in your
current VS Code theme.

Use `Developer: Inspect Editor Tokens and Scopes` on a token you like and note
the winning scope family.

Temporary probe mapping on this branch:

- Plain unquoted table text:
  - existing scope: `string.unquoted.tabletest`
  - added probe family: `variable.other.readwrite.tabletest.probe`
- Header cells:
  - existing scope: `entity.name.column.tabletest`
  - added probe family: `entity.name.type.tabletest.probe`
- Pipe separators:
  - existing scope: `keyword.operator.tabletest.pipe`
  - added probe family: `constant.language.tabletest.probe`
- Map keys:
  - existing scope: `support.type.property-name.tabletest`
  - added probe family: `entity.other.attribute-name.tabletest.probe`
- Commas and map colons:
  - existing scopes: `punctuation.separator.comma.tabletest`,
    `keyword.operator.assignment.tabletest`
  - added probe family: `keyword.operator.tabletest.probe`
- Collection brackets and braces:
  - existing scopes: `punctuation.section.brackets.*.tabletest`,
    `punctuation.section.braces.*.tabletest`
  - added probe family: `entity.name.type.tabletest.probe`

The normal quoted-string and comment families are unchanged, since they already
map to strong standard theme colours in most themes.
