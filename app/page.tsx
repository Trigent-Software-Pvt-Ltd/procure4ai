"use client";

import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

/* ═══════════════════════ types & constants ═══════════════════════ */

type Step = "upload" | "preview" | "rationalize" | "export";

const STEPS: { key: Step; label: string; num: string }[] = [
  { key: "upload", label: "Intake", num: "1" },
  { key: "preview", label: "Consolidate", num: "2" },
  { key: "rationalize", label: "Rationalize", num: "3" },
  { key: "export", label: "Output", num: "4" },
];

interface FileData {
  fileName: string;
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  sources: string[];
  target: string;
}

interface DetailedStats {
  totalFiles: number;
  totalSourceRows: number;
  columnMappings: ColumnMapping[];
  sourceColumns: number;
  outputColumns: number;
  duplicatesRemoved: number;
  abbreviationsFixed: number;
  casingFixed: number;
  whitespaceFixed: number;
  outputRows: number;
}

type Phase = "idle" | "analyzing" | "mapping" | "deduplicating" | "normalizing" | "done";

/* ── Smart column synonym map ── */

const COLUMN_SYNONYMS: Record<string, string[]> = {
  "Part Number": ["part number", "p/n", "pn", "item code", "item id", "sku", "part no", "part no."],
  "Description": ["description", "desc", "desc.", "part desc", "part description", "item description", "name", "item name"],
  "Quantity": ["quantity", "qty", "qty.", "units", "count", "amount"],
  "Unit of Measure": ["unit of measure", "uom", "unit"],
  "Unit Price": ["unit price", "price", "cost per unit", "cost", "rate", "estimated cost", "price per unit"],
  "Supplier": ["supplier", "vendor", "mfg", "mfg.", "mfr", "mfr.", "manufacturer", "source"],
};

/* ── Value abbreviation map ── */

const VALUE_ABBREVIATIONS: Record<string, string> = {
  ea: "Each", "ea.": "Each", EA: "Each",
  pcs: "Pieces", "pcs.": "Pieces", PCS: "Pieces", pc: "Pieces",
  nos: "Numbers", "nos.": "Numbers",
};

/* ── CSV parser ── */

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else current += ch;
  }
  result.push(current.trim());
  return result;
}

/* ═══════════════════════ Main Component ═══════════════════════ */

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<FileData[]>([]);
  const [mergedHeaders, setMergedHeaders] = useState<string[]>([]);
  const [mergedRows, setMergedRows] = useState<string[][]>([]);
  const [rationHeaders, setRationHeaders] = useState<string[]>([]);
  const [rationRows, setRationRows] = useState<string[][]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [stats, setStats] = useState<DetailedStats>({
    totalFiles: 0, totalSourceRows: 0, columnMappings: [], sourceColumns: 0,
    outputColumns: 0, duplicatesRemoved: 0, abbreviationsFixed: 0,
    casingFixed: 0, whitespaceFixed: 0, outputRows: 0,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  /* ── file parsing ── */

  const ingestFiles = useCallback(async (list: FileList) => {
    const parsed: FileData[] = [];
    for (const file of Array.from(list)) {
      try {
        if (file.name.endsWith(".csv")) {
          const text = await file.text();
          const lines = text.split("\n").filter((l) => l.trim());
          if (lines.length > 0) {
            parsed.push({ fileName: file.name, headers: parseCSVLine(lines[0]), rows: lines.slice(1).map(parseCSVLine) });
          }
        } else if (/\.xlsx?$/i.test(file.name)) {
          const wb = XLSX.read(await file.arrayBuffer());
          const raw: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          if (raw.length > 0) {
            const headers = (raw[0] as unknown[]).map((h) => String(h ?? "").trim());
            const rows = raw.slice(1)
              .filter((r) => (r as unknown[]).some((c) => String(c ?? "").trim() !== ""))
              .map((r) => headers.map((_, i) => String((r as unknown[])[i] ?? "").trim()));
            parsed.push({ fileName: file.name, headers, rows });
          }
        }
      } catch (err) { console.error(`Failed to parse ${file.name}`, err); }
    }
    setFiles((prev) => [...prev, ...parsed]);
  }, []);

  /* ── smart column mapping & merge ── */

  const mergeAndPreview = () => {
    // Build synonym lookup
    const synonymLookup = new Map<string, string>();
    for (const [standard, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
      for (const s of synonyms) synonymLookup.set(s, standard);
    }

    // Collect all unique source column names
    const allSourceCols = new Set<string>();
    files.forEach((f) => f.headers.forEach((h) => allSourceCols.add(h)));

    // Map each source column to standard name
    const colMapping = new Map<string, string>(); // lowered source → standard
    const standardCols: string[] = [];
    const mappingTracker = new Map<string, Set<string>>(); // standard → set of source names

    for (const src of allSourceCols) {
      const key = src.toLowerCase().trim();
      const standard = synonymLookup.get(key);
      if (standard) {
        colMapping.set(key, standard);
        if (!mappingTracker.has(standard)) {
          mappingTracker.set(standard, new Set());
          standardCols.push(standard);
        }
        mappingTracker.get(standard)!.add(src);
      } else {
        // Keep as title-cased passthrough
        const titled = key.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        colMapping.set(key, titled);
        if (!mappingTracker.has(titled)) {
          mappingTracker.set(titled, new Set());
          standardCols.push(titled);
        }
        mappingTracker.get(titled)!.add(src);
      }
    }

    // Build column mappings for display
    const columnMappings: ColumnMapping[] = [];
    for (const [target, sources] of mappingTracker) {
      columnMappings.push({ target, sources: Array.from(sources) });
    }

    // Merge rows
    const rows: string[][] = [];
    files.forEach((f) => {
      const headerMap = new Map<number, number>();
      f.headers.forEach((h, i) => {
        const standard = colMapping.get(h.toLowerCase().trim());
        if (standard) {
          const idx = standardCols.indexOf(standard);
          if (idx >= 0) headerMap.set(i, idx);
        }
      });
      f.rows.forEach((row) => {
        const merged = new Array(standardCols.length).fill("");
        row.forEach((cell, i) => {
          const idx = headerMap.get(i);
          if (idx !== undefined) merged[idx] = cell;
        });
        rows.push(merged);
      });
    });

    setMergedHeaders(standardCols);
    setMergedRows(rows);
    setStats((prev) => ({
      ...prev,
      totalFiles: files.length,
      totalSourceRows: rows.length,
      sourceColumns: allSourceCols.size,
      outputColumns: standardCols.length,
      columnMappings,
    }));
    setStep("preview");
  };

  /* ── phased rationalization ── */

  const rationalize = () => {
    setStep("rationalize");
    setPhase("analyzing");

    // Phase 1: Analyzing (700ms)
    setTimeout(() => setPhase("mapping"), 700);

    // Phase 2: Mapping (900ms) — headers already mapped, visual only
    setTimeout(() => {
      setPhase("deduplicating");
    }, 1600);

    // Phase 3: Deduplicating (900ms)
    setTimeout(() => {
      setPhase("normalizing");
    }, 2500);

    // Phase 4: Normalizing + finalize (900ms)
    setTimeout(() => {
      let abbrFixed = 0, casingFixed = 0, wsFixed = 0;

      const normalized = mergedRows.map((row) =>
        row.map((cell) => {
          const orig = cell;
          let c = cell.trim();
          if (c !== cell) wsFixed++;
          c = c.replace(/\s+/g, " ");

          // Fix value abbreviations
          if (VALUE_ABBREVIATIONS[c]) { c = VALUE_ABBREVIATIONS[c]; abbrFixed++; }

          // Fix casing for all-upper or all-lower descriptions > 3 chars
          if (c.length > 3 && (c === c.toUpperCase() || c === c.toLowerCase())) {
            const titled = c.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
            if (titled !== c) { c = titled; casingFixed++; }
          }

          return c;
        }),
      );

      // Deduplicate
      const seen = new Set<string>();
      const deduped: string[][] = [];
      let dupsRemoved = 0;
      normalized.forEach((row) => {
        const key = row.map((c) => c.toLowerCase()).join("|");
        if (!seen.has(key)) { seen.add(key); deduped.push(row); }
        else dupsRemoved++;
      });

      const cleaned = deduped.filter((r) => r.some((c) => c !== ""));
      dupsRemoved += deduped.length - cleaned.length;

      setRationHeaders(mergedHeaders);
      setRationRows(cleaned);
      setStats((prev) => ({
        ...prev,
        duplicatesRemoved: dupsRemoved,
        abbreviationsFixed: abbrFixed,
        casingFixed,
        whitespaceFixed: wsFixed,
        outputRows: cleaned.length,
      }));
      setPhase("done");
    }, 3400);
  };

  /* ── export ── */

  const exportCSV = () => {
    const csv = [
      rationHeaders.map((h) => `"${h}"`).join(","),
      ...rationRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "rationalized_procurement_data.csv" }).click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([rationHeaders, ...rationRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rationalized Data");
    XLSX.writeFile(wb, "rationalized_procurement_data.xlsx");
  };

  const reset = () => {
    setFiles([]); setMergedHeaders([]); setMergedRows([]);
    setRationHeaders([]); setRationRows([]); setPhase("idle");
    setStats({ totalFiles: 0, totalSourceRows: 0, columnMappings: [], sourceColumns: 0, outputColumns: 0, duplicatesRemoved: 0, abbreviationsFixed: 0, casingFixed: 0, whitespaceFixed: 0, outputRows: 0 });
    setStep("upload");
  };

  /* ── drag handlers ── */
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files); };

  /* ═══════════════════════ RENDER ═══════════════════════ */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Stepper ── */}
      <nav className="mb-8">
        <ol className="flex items-center justify-center gap-1 sm:gap-3">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            const done = i < stepIdx;
            return (
              <li key={s.key} className="flex items-center gap-1 sm:gap-3">
                <button onClick={() => done && setStep(s.key)} disabled={!done}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${active ? "bg-[#F0B800] text-[#0a0a0f] shadow-md" : ""}
                    ${done ? "bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200" : ""}
                    ${!active && !done ? "bg-gray-100 text-gray-400" : ""}
                  `}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${active ? "bg-[#0a0a0f] text-[#F0B800]" : ""}
                    ${done ? "bg-emerald-500 text-white" : ""}
                    ${!active && !done ? "bg-gray-300 text-white" : ""}
                  `}>{done ? "\u2713" : s.num}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 sm:w-10 h-0.5 ${i < stepIdx ? "bg-emerald-400" : "bg-gray-200"}`} />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ═══════════ STEP 1: UPLOAD ═══════════ */}
      {step === "upload" && (
        <div className="animate-fade-in">
          {/* Hero */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Multi-Source Procurement Data Intake</h2>
              <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
                Consolidate procurement data from multiple customers, formats, and nomenclatures
                into a single, standardized output &mdash; ready for inventory and pricing validation.
              </p>
            </div>

            {/* Value props */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-center">
                <div className="w-10 h-10 bg-[#F0B800] rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Multi-Source Intake</h3>
                <p className="text-xs text-gray-500 mt-1">Excel, CSV &mdash; any column structure. Different customers, different formats, one system.</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-center">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Smart Rationalization</h3>
                <p className="text-xs text-gray-500 mt-1">Auto-map fields, deduplicate records, normalize nomenclature. Configurable business rules.</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-center">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">100% Offline &amp; Secure</h3>
                <p className="text-xs text-gray-500 mt-1">Standalone, air-gapped. Your data and transformation logic never leave your infrastructure.</p>
              </div>
            </div>

            {/* Before / After */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Today</p>
                <ul className="space-y-1.5 text-sm text-red-900/80">
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">&times;</span>Multiple customer formats &amp; nomenclatures</li>
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">&times;</span>6-week manual turnaround</li>
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">&times;</span>5+ manual touchpoints, error-prone</li>
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">&times;</span>Data exposed to cloud AI services</li>
                </ul>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">With Procure4AI</p>
                <ul className="space-y-1.5 text-sm text-emerald-900/80">
                  <li className="flex items-start gap-2"><svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Automated multi-format intake &amp; mapping</li>
                  <li className="flex items-start gap-2"><svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Minutes instead of weeks</li>
                  <li className="flex items-start gap-2"><svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Zero manual intervention, repeatable</li>
                  <li className="flex items-start gap-2"><svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>100% offline, air-gapped deployment</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Upload Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Upload Source Files</h3>
            <p className="text-sm text-gray-500 mb-5">Upload procurement data from different customers or systems &mdash; each can have different column structures.</p>

            <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                ${dragging ? "border-[#F0B800] bg-amber-50" : "border-gray-300 hover:border-[#F0B800] hover:bg-gray-50"}`}>
              <div className="mx-auto w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-[#F0B800]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-base font-medium text-gray-700">Drag &amp; drop files here</p>
              <p className="text-sm text-gray-400 mt-1">or click to browse</p>
              <p className="text-xs text-gray-300 mt-2">Supports .xlsx, .xls, .csv</p>
              <input ref={inputRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => e.target.files && ingestFiles(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div className="mt-5 space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Sources Loaded ({files.length})</h4>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{f.fileName}</p>
                        <p className="text-xs text-gray-400">{f.rows.length.toLocaleString()} rows &middot; {f.headers.length} columns ({f.headers.slice(0, 3).join(", ")}{f.headers.length > 3 ? "..." : ""})</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)); }} className="text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button onClick={mergeAndPreview} disabled={files.length === 0}
                className="px-6 py-3 bg-[#F0B800] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#D4A200] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                Consolidate &amp; Preview &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 2: PREVIEW ═══════════ */}
      {step === "preview" && (
        <div className="animate-fade-in">
          {/* Merge summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Consolidated Data Preview</h2>

            {/* Column mapping visual */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Field Mapping Applied</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {stats.columnMappings.filter((m) => m.sources.length > 1 || m.sources[0] !== m.target).map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-md px-3 py-2 border border-gray-200">
                    <span className="text-gray-400 font-mono truncate max-w-[140px]" title={m.sources.join(", ")}>{m.sources.join(", ")}</span>
                    <span className="text-[#F0B800] font-bold">&rarr;</span>
                    <span className="text-gray-900 font-semibold">{m.target}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">{stats.sourceColumns} source columns mapped to {stats.outputColumns} standard columns across {stats.totalFiles} files</p>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <span className="font-semibold text-gray-900">{mergedRows.length.toLocaleString()}</span> total rows from
              <span className="font-semibold text-gray-900">{files.length}</span> source files &mdash; raw, unprocessed
            </div>

            <DataTable headers={mergedHeaders} rows={mergedRows} />

            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep("upload")} className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all">&larr; Back</button>
              <button onClick={rationalize} className="px-6 py-3 bg-[#F0B800] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#D4A200] transition-all shadow-sm">
                Rationalize Data &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 3: RATIONALIZE ═══════════ */}
      {step === "rationalize" && (
        <div className="animate-fade-in">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">

            {/* Processing Animation */}
            {phase !== "done" && (
              <div className="py-8">
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Applying Business Rules</h2>
                <div className="max-w-lg mx-auto space-y-4">
                  <PhaseRow label="Analyzing source structures" detail={`${stats.totalFiles} files, ${stats.totalSourceRows.toLocaleString()} rows`} phase="analyzing" current={phase} />
                  <PhaseRow label="Mapping fields to standard schema" detail={`${stats.sourceColumns} columns → ${stats.outputColumns} standard`} phase="mapping" current={phase} />
                  <PhaseRow label="Removing duplicate records" detail="Scanning for exact row matches" phase="deduplicating" current={phase} />
                  <PhaseRow label="Normalizing data values" detail="Abbreviations, casing, whitespace" phase="normalizing" current={phase} />
                </div>
              </div>
            )}

            {/* Results */}
            {phase === "done" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Rationalization Complete</h2>
                  <p className="text-gray-500 mt-1">All business rules applied. Your data is cleaned, deduplicated, and standardized.</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                  <StatCard label="Source Files" value={stats.totalFiles} cls="bg-blue-50 text-blue-700" />
                  <StatCard label="Input Rows" value={stats.totalSourceRows} cls="bg-gray-100 text-gray-700" />
                  <StatCard label="Duplicates Removed" value={stats.duplicatesRemoved} cls="bg-red-50 text-red-600" />
                  <StatCard label="Abbreviations Fixed" value={stats.abbreviationsFixed} cls="bg-amber-50 text-amber-700" />
                  <StatCard label="Casing Normalized" value={stats.casingFixed} cls="bg-purple-50 text-purple-700" />
                  <StatCard label="Output Rows" value={stats.outputRows} cls="bg-emerald-50 text-emerald-700" />
                </div>

                {/* Rules Applied */}
                <details className="mb-6 bg-gray-50 rounded-lg border border-gray-200">
                  <summary className="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors">
                    Business Rules Applied ({stats.columnMappings.length} mappings, {stats.duplicatesRemoved + stats.abbreviationsFixed + stats.casingFixed + stats.whitespaceFixed} corrections)
                  </summary>
                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">Rule 1: Field Mapping</p>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.columnMappings.filter((m) => m.sources.length > 1 || m.sources[0] !== m.target).map((m, i) => (
                          <span key={i} className="text-xs bg-white border border-gray-200 rounded px-2 py-1">
                            <span className="text-gray-400">{m.sources.join(" / ")}</span> <span className="text-[#F0B800] font-bold">&rarr;</span> <span className="font-semibold">{m.target}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">Rule 2: Deduplication</p>
                      <p className="text-xs text-gray-600">Removed <strong>{stats.duplicatesRemoved.toLocaleString()}</strong> exact duplicate rows (case-insensitive match across all columns)</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">Rule 3: Value Normalization</p>
                      <p className="text-xs text-gray-600">Standardized <strong>{stats.abbreviationsFixed.toLocaleString()}</strong> abbreviations (ea &rarr; Each, pcs &rarr; Pieces, etc.), normalized <strong>{stats.casingFixed.toLocaleString()}</strong> casing issues, cleaned <strong>{stats.whitespaceFixed.toLocaleString()}</strong> whitespace problems</p>
                    </div>
                  </div>
                </details>

                <DataTable headers={rationHeaders} rows={rationRows} />

                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep("preview")} className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all">&larr; Back</button>
                  <button onClick={() => setStep("export")} className="px-6 py-3 bg-[#F0B800] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#D4A200] transition-all shadow-sm">
                    Export &amp; Next Steps &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ STEP 4: EXPORT ═══════════ */}
      {step === "export" && (
        <div className="animate-fade-in space-y-6">
          {/* Download */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Standardized Output Ready</h2>
            <p className="text-gray-500 mt-1">{rationRows.length.toLocaleString()} clean, deduplicated rows — ready for backend system queries</p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
              <button onClick={exportCSV} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#F0B800] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#D4A200] transition-all shadow-sm">
                <DownloadIcon /> Download CSV
              </button>
              <button onClick={exportExcel} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all shadow-sm">
                <DownloadIcon /> Download Excel
              </button>
            </div>
          </div>

          {/* Integration Roadmap */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-1">What&apos;s Next: Integration Roadmap</h3>
            <p className="text-sm text-gray-500 mb-6">The standardized output from Step 4 feeds directly into your backend systems.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <RoadmapCard step="1" title="Data Intake & Standardization" desc="Multi-source consolidation, field mapping, deduplication, normalization" done />
              <RoadmapCard step="2" title="Inventory Match" desc="Query standardized Part Numbers against your master inventory database" />
              <RoadmapCard step="3" title="Pricing Rules" desc="Apply customer-specific pricing rules, volume discounts, and availability checks" />
              <RoadmapCard step="4" title="Procurement Proposition" desc="Auto-generate quotes with availability, pricing, and lead time estimates" />
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Enterprise Security Advantage</p>
                  <p className="text-xs text-blue-800/70 mt-1">
                    Unlike cloud-based AI solutions, Procure4AI runs entirely on your infrastructure. Your data never leaves your network.
                    Your transformation logic and business rules remain proprietary &mdash; no risk of competitive intelligence leakage through shared AI models.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors">
              Start over with new files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ Sub-Components ═══════════════════════ */

const PHASE_ORDER: Phase[] = ["analyzing", "mapping", "deduplicating", "normalizing"];

function PhaseRow({ label, detail, phase, current }: { label: string; detail: string; phase: Phase; current: Phase }) {
  const ci = PHASE_ORDER.indexOf(current);
  const pi = PHASE_ORDER.indexOf(phase);
  const done = ci > pi;
  const active = ci === pi;
  const pending = ci < pi;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${active ? "bg-amber-50 border-[#F0B800] shadow-sm" : done ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
      <div className="shrink-0">
        {done && <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>}
        {active && (
          <div className="w-8 h-8 bg-[#F0B800] rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        )}
        {pending && <div className="w-8 h-8 bg-gray-200 rounded-full" />}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${active ? "text-gray-900" : done ? "text-emerald-700" : "text-gray-400"}`}>{label}</p>
        <p className={`text-xs ${active ? "text-gray-600" : done ? "text-emerald-600" : "text-gray-300"}`}>{detail}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-lg p-4 ${cls}`}>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
  );
}

function RoadmapCard({ step, title, desc, done }: { step: string; title: string; desc: string; done?: boolean }) {
  return (
    <div className={`rounded-lg p-4 border ${done ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-emerald-500 text-white" : "bg-gray-300 text-white"}`}>
          {done ? "\u2713" : step}
        </span>
        <span className={`text-xs font-bold uppercase ${done ? "text-emerald-600" : "text-gray-400"}`}>{done ? "Complete" : "Next"}</span>
      </div>
      <p className={`text-sm font-semibold ${done ? "text-emerald-900" : "text-gray-700"}`}>{title}</p>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const MAX = 100;
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, MAX).map((row, i) => (
            <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
              <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate" title={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > MAX && (
        <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 text-center">
          Showing first {MAX} of {rows.length.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
