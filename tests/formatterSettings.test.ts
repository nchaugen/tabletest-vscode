import * as assert from "node:assert/strict";
import * as path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  expandJavaFormatterPathVariables,
  resolveJavaFormatterSettingsPath
} from "../src/nodeFormatterSettings";
import {
  attributeValue,
  hasExplicitConfigurationValue,
  indentStringForLevels,
  readFormatterSetting
} from "../src/formatterSettings";

test("detects explicit formatter configuration values including zero", () => {
  assert.strictEqual(hasExplicitConfigurationValue(null), false);
  assert.strictEqual(hasExplicitConfigurationValue({}), false);
  assert.strictEqual(hasExplicitConfigurationValue({ globalValue: 0 }), true);
  assert.strictEqual(hasExplicitConfigurationValue({ workspaceLanguageValue: 2 }), true);
});

test("builds indent strings for tabs and spaces", () => {
  assert.strictEqual(indentStringForLevels(0, 4, true), "");
  assert.strictEqual(indentStringForLevels(2, 2, true), "    ");
  assert.strictEqual(indentStringForLevels(3, 4, false), "\t\t\t");
});

test("reads formatter XML settings with single or double quoted attributes", () => {
  const formatterXml = [
    "<profiles>",
    "  <profile>",
    '    <setting id="double.quoted" value="2"/>',
    "    <setting id='single.quoted' value='3'/>",
    "    <setting id='negative' value='-4'/>",
    "  </profile>",
    "</profiles>"
  ].join("\n");

  assert.strictEqual(readFormatterSetting(formatterXml, "double.quoted"), 2);
  assert.strictEqual(readFormatterSetting(formatterXml, "single.quoted"), 3);
  assert.strictEqual(readFormatterSetting(formatterXml, "negative"), 0);
  assert.strictEqual(readFormatterSetting(formatterXml, "missing"), null);
});

test("returns null for invalid formatter XML setting values", () => {
  const formatterXml = "<setting id='bad' value='abc'/>";
  assert.strictEqual(readFormatterSetting(formatterXml, "bad"), null);
});

test("extracts attribute values from XML tags", () => {
  const tag = "<setting id='example' value=\"42\"/>";
  assert.strictEqual(attributeValue(tag, "id"), "example");
  assert.strictEqual(attributeValue(tag, "value"), "42");
  assert.strictEqual(attributeValue(tag, "missing"), null);
});

test("expands formatter path variables", () => {
  const env = {
    HOME: "/Users/tester",
    FORMATTER_DIR: "profiles"
  };

  assert.strictEqual(
    expandJavaFormatterPathVariables("${workspaceFolder}/.idea/${env:FORMATTER_DIR}/formatter.xml", "/workspace", env),
    "/workspace/.idea/profiles/formatter.xml"
  );
  assert.strictEqual(
    expandJavaFormatterPathVariables("${workspaceFolder:tabletest-vscode}/formatter.xml", "/workspace", env),
    "/workspace/formatter.xml"
  );
  assert.strictEqual(
    expandJavaFormatterPathVariables("~/formatter.xml", "/workspace", env),
    path.join("/Users/tester", "formatter.xml")
  );
});

test("resolves formatter settings paths from configured URLs", () => {
  const workspaceRoot = "/workspace";
  const env = {
    HOME: "/Users/tester",
    FORMATTER_DIR: "profiles"
  };
  const absolutePath = "/opt/formatter.xml";
  const fileUrl = pathToFileURL("/tmp/file-formatter.xml").toString();

  assert.strictEqual(resolveJavaFormatterSettingsPath("https://example.com/formatter.xml", workspaceRoot, env), null);
  assert.strictEqual(resolveJavaFormatterSettingsPath(fileUrl, workspaceRoot, env), "/tmp/file-formatter.xml");
  assert.strictEqual(resolveJavaFormatterSettingsPath(absolutePath, workspaceRoot, env), absolutePath);
  assert.strictEqual(
    resolveJavaFormatterSettingsPath("config/formatter.xml", workspaceRoot, env),
    path.join(workspaceRoot, "config/formatter.xml")
  );
  assert.strictEqual(
    resolveJavaFormatterSettingsPath("${workspaceFolder}/.idea/${env:FORMATTER_DIR}/formatter.xml", workspaceRoot, env),
    path.join(workspaceRoot, ".idea/profiles/formatter.xml")
  );
  assert.strictEqual(
    resolveJavaFormatterSettingsPath("~/formatter.xml", workspaceRoot, env),
    path.join("/Users/tester", "formatter.xml")
  );
  assert.strictEqual(resolveJavaFormatterSettingsPath("relative.xml", "", env), null);
});
