// Small, dependency-free export writers. XLSX uses explicit text cells, never formulas.
// Format references: Microsoft SpreadsheetML; PKWARE APPNOTE; PDF 32000-1 §8.9.
export type ExportCell = string | number | bigint;
export type ExportDocument = { title: string; subtitle: string; note: string; summary: ExportCell[][]; columns: string[]; rows: ExportCell[][] };
const utf8 = (value: string) => new TextEncoder().encode(value);
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const xml = (value: ExportCell) => clean(String(value)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const matrix = (doc: ExportDocument): ExportCell[][] => [[doc.title], [doc.subtitle], [doc.note], [], ...doc.summary, [], doc.columns, ...doc.rows];
export function reportCsv(doc: ExportDocument): Blob {
  const cell = (value: ExportCell) => {
    const text = String(value);
    // Quotes alone do not prevent spreadsheet formula injection.
    const safe = typeof value === "string" && /^[\s\uFEFF]*[=+@-]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  return new Blob(["\ufeff", matrix(doc).map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
}
function zip(files: Record<string, string>): Blob {
  const local: BlobPart[] = [], central: BlobPart[] = []; let offset = 0, directorySize = 0;
  const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff;
    bytes.forEach(byte => { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); });
    return (crc ^ 0xffffffff) >>> 0;
  };
  for (const [name, content] of Object.entries(files)) {
    const filename = utf8(name), bytes = utf8(content), crc = crc32(bytes);
    const header = new Uint8Array(30), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint16(12, 33, true); view.setUint32(14, crc, true); view.setUint32(18, bytes.length, true); view.setUint32(22, bytes.length, true); view.setUint16(26, filename.length, true);
    local.push(header, filename, bytes);
    const entry = new Uint8Array(46), v = new DataView(entry.buffer);
    v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint16(8, 0x800, true); v.setUint16(14, 33, true);
    v.setUint32(16, crc, true); v.setUint32(20, bytes.length, true); v.setUint32(24, bytes.length, true); v.setUint16(28, filename.length, true); v.setUint32(42, offset, true);
    central.push(entry, filename); directorySize += 46 + filename.length; offset += 30 + filename.length + bytes.length;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer), count = Object.keys(files).length;
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, count, true); view.setUint16(10, count, true); view.setUint32(12, directorySize, true); view.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
export function reportXlsx(doc: ExportDocument): Blob {
  const sheet = matrix(doc).map((row, index) => `<row r="${index + 1}">${row.map((cell, col) => `<c r="${String.fromCharCode(65 + col)}${index + 1}"${typeof cell === "number" || typeof cell === "bigint" ? `><v>${cell}</v>` : ` t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is>`}</c>`).join("")}</row>`).join("");
  return zip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="35" customWidth="1"/><col min="2" max="${Math.max(6, doc.columns.length)}" width="24" customWidth="1"/></cols><sheetData>${sheet}</sheetData></worksheet>`,
  });
}

/** Raster pages preserve the browser's Unicode font rendering without remote fonts. */
export async function reportPdf(doc: ExportDocument): Promise<Blob> {
  await document.fonts.ready;
  const objects: BlobPart[][] = [[], []], pages: number[] = [];
  const add = (parts: BlobPart[]) => { objects.push(parts); return objects.length; };
  const canvas = document.createElement("canvas"); canvas.width = 1684; canvas.height = 1190;
  const ctx = canvas.getContext("2d"); if (!ctx) throw Error("Canvas unavailable");
  // Wrap every cell, including long Unicode service names, without clipping rows.
  let widths = [400, 320, 250, 230, 280];
  const wrap = (text: string, width: number) => {
    const lines: string[] = []; let line = "";
    for (const character of clean(text).replace(/[\r\n]/g, " ")) {
      if (line && ctx.measureText(line + character).width > width - 24) { lines.push(line); line = ""; }
      line += character;
    }
    lines.push(line); return lines;
  };
  let y = 0;
  const drawRow = (row: ExportCell[], header = false, wrapped?: string[][]) => {
    ctx.font = `${header ? "bold " : ""}22px Arial, sans-serif`;
    const cells = wrapped ?? row.map((cell, index) => wrap(String(cell), widths[index] ?? 280));
    const height = Math.max(1, ...cells.map(lines => lines.length)) * 30 + 18;
    ctx.fillStyle = header ? "#ede9fe" : "#f8fafc"; ctx.fillRect(60, y, 1480, height);
    ctx.fillStyle = "#172033"; let x = 60;
    cells.forEach((lines, index) => { lines.forEach((line, i) => ctx.fillText(line, x + 10, y + 30 + i * 30)); x += widths[index] ?? 280; });
    y += height + 4;
  };
  const startPage = () => {
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    y = 38; ctx.fillStyle = "#5b21b6"; ctx.font = "bold 36px Arial, sans-serif";
    for (const line of wrap(doc.title, 1480)) { ctx.fillText(line, 60, y + 32); y += 44; }
    ctx.fillStyle = "#334155"; ctx.font = "22px Arial, sans-serif";
    for (const line of wrap(doc.subtitle, 1480)) { ctx.fillText(line, 60, y + 24); y += 30; }
    y += 28;
  };
  const finishPage = () => {
    ctx.fillStyle = "#475569"; ctx.font = "20px Arial, sans-serif"; ctx.fillText(String(pages.length + 1), 1540, 1150);
    const image = Uint8Array.from(atob(canvas.toDataURL("image/jpeg", .94).split(",")[1]), char => char.charCodeAt(0));
    const imageId = add([`<< /Type /XObject /Subtype /Image /Width 1684 /Height 1190 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`, image, "\nendstream"]);
    const stream = "q 842 0 0 595 0 0 cm /Im0 Do Q";
    const contentId = add([`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]);
    pages.push(add([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]));
  };
  startPage();
  ctx.font = "22px Arial, sans-serif";
  for (const line of wrap(doc.note, 1480)) { ctx.fillText(line, 60, y + 24); y += 30; }
  y += 16;
  for (const row of doc.summary) { if (y > 930) { finishPage(); startPage(); } drawRow(row); }
  // Summary keeps its five money columns. Detail/group tables divide the same
  // printable width, including employee and per-service status-count columns.
  if (doc.columns.length !== 5) widths = doc.columns.map((_, index) => 1480 * (index === 0 ? 2 : 1) / (doc.columns.length + 1));
  if (y > 930) { finishPage(); startPage(); }
  y += 20; drawRow(doc.columns, true);
  for (const row of doc.rows) {
    ctx.font = "22px Arial, sans-serif";
    const lines = row.map((value, index) => wrap(String(value), widths[index] ?? 280));
    // Split exceptionally long cells over pages instead of losing content.
    for (let offset = 0; offset < Math.max(...lines.map(cell => cell.length));) {
      if (y > 1000) { finishPage(); startPage(); drawRow(doc.columns, true); }
      const take = Math.max(1, Math.floor((1060 - y - 18) / 30));
      drawRow([], false, lines.map(cell => cell.slice(offset, offset + take))); offset += take;
    }
  }
  finishPage();
  objects[0] = ["<< /Type /Catalog /Pages 2 0 R >>"];
  objects[1] = [`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(id => `${id} 0 R`).join(" ")}] >>`];
  const parts: BlobPart[] = ["%PDF-1.4\n"], offsets = [0]; let size = utf8(String(parts[0])).length;
  objects.forEach((object, index) => { offsets.push(size); const blob = new Blob([`${index + 1} 0 obj\n`, ...object, "\nendobj\n"]); parts.push(blob); size += blob.size; });
  parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
export function downloadReport(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
