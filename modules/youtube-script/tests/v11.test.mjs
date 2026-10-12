import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";

import { crc32, documentXml, scriptDocx, zip } from "../scripts/lib/docx.mjs";
import { screenIssues } from "../scripts/lib/rules.mjs";
import { markInterval, parseScript, screenSync, timing } from "../scripts/lib/script.mjs";

/** Reads a ZIP back through its central directory, the way Word does. */
function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(at), 0x02014b50);
    const method = buffer.readUInt16LE(at + 10);
    const crc = buffer.readUInt32LE(at + 16);
    const packedSize = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const packed = buffer.subarray(dataStart, dataStart + packedSize);
    const data = method === 8 ? inflateRawSync(packed) : packed;
    assert.equal(crc32(data), crc, `crc of ${name}`);
    files[name] = data.toString("utf8");
    at += 46 + nameLength + buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
  }
  return files;
}

test("crc32 and zip produce an archive that reads back intact", () => {
  assert.equal(crc32(Buffer.from("123456789")).toString(16), "cbf43926");
  const files = unzip(zip([{ name: "a.txt", data: "olá" }, { name: "pasta/b.xml", data: "<x/>" }]));
  assert.deepEqual(files, { "a.txt": "olá", "pasta/b.xml": "<x/>" });
});

test("the docx carries the parts Word needs and the script as styled paragraphs", () => {
  const files = unzip(scriptDocx("# Título & teste\n\n## Gancho\nFala <com> acento. [TELA 3s: o site]\n> Nota para o criador\n"));
  for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/_rels/document.xml.rels", "word/styles.xml"]) assert.ok(files[part], part);
  const xml = files["word/document.xml"];
  assert.match(xml, /<w:pStyle w:val="Title"\/><\/w:pPr><w:r><w:t xml:space="preserve">Título &amp; teste<\/w:t>/);
  assert.match(xml, /<w:pStyle w:val="Heading1"\/>.*Gancho/);
  assert.match(xml, /Fala &lt;com&gt; acento\. /);
  assert.match(xml, /<w:i\/><w:color w:val="7A7A7A"\/><\/w:rPr><w:t xml:space="preserve">\[TELA 3s: o site\]/);
  assert.match(xml, /w:val="Note".*Nota para o criador/);
  assert.ok(!documentXml("texto \u0001 com controle").includes("\u0001"));
});

test("screen marks with an interval map the narration onto the recording", () => {
  assert.deepEqual(markInterval("[TELA 00:12–00:31: digita]"), { start_s: 12, end_s: 31 });
  assert.deepEqual(markInterval("[TELA 1:02:03 a 1:02:20: x]"), { start_s: 3723, end_s: 3740 });
  assert.equal(markInterval("[TELA: x]"), null);
  assert.equal(markInterval("[TELA 00:31–00:12: invertido]"), null);
  const script = parseScript(
    "## 1. O pedido\n[TELA 00:12–00:31: digita o pedido]\nAqui você escreve o que quer como se pedisse a uma pessoa.\n[TELA 00:31–01:05: montando · acelerar]\nRepare.\n[TELA 01:05–01:08: Publicar]\n" + "palavra ".repeat(45) + "\n[CONGELAR 2s]\n",
  );
  const stretches = screenSync(script, 180);
  assert.deepEqual(stretches.map((stretch) => [stretch.screen_s, stretch.words, stretch.shortened]), [[19, 12, false], [34, 1, true], [5, 45, false]]);
  const issues = screenIssues(stretches);
  assert.deepEqual(issues.map((issue) => issue.rule), ["idle_screen", "speech_over_screen"]);
  // A freeze adds silent seconds to the estimate; an interval only places the speech.
  assert.equal(timing(script, 180).sections[0].est_s, Math.round((58 / 180) * 60 + 2));
});
