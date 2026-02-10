"use client";

import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

/* ────────────────────────── types ────────────────────────── */

type Step = "upload" | "preview" | "rationalize" | "export";

const STEPS: { key: Step; label: string; num: string }[] = [
  { key: "upload", label: "Upload", num: "1" },
  { key: "preview", label: "Preview", num: "2" },
  { key: "rationalize", label: "Rationalize", num: "3" },
  { key: "export", label: "Export", num: "4" },
];

interface FileData {
  fileName: string;
  headers: string[];
  rows: string[][];
}

interface Stats {
  totalFiles: number;
  totalRows: number;
  duplicatesRemoved: number;
  fieldsNormalized: number;
}

/* ──────────────────── CSV line parser ──────────────────── */

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/* ──────────────────── abbreviation map ──────────────────── */

const ABBREVIATIONS: Record<string, string> = {
  qty: "Quantity",
  "qty.": "Quantity",
  desc: "Description",
  "desc.": "Description",
  "p/n": "Part Number",
  pn: "Part Number",
  uom: "Unit of Measure",
  ea: "Each",
  "ea.": "Each",
  pcs: "Pieces",
  "pcs.": "Pieces",
  "no.": "Number",
  num: "Number",
  mfg: "Manufacturer",
  mfr: "Manufacturer",
  "mfg.": "Manufacturer",
};

/* ═══════════════════════════════════════════════════════════
   Main page component
   ═══════════════════════════════════════════════════════════ */

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<FileData[]>([]);
  const [mergedHeaders, setMergedHeaders] = useState<string[]>([]);
  const [mergedRows, setMergedRows] = useState<string[][]>([]);
  const [rationHeaders, setRationHeaders] = useState<string[]>([]);
  const [rationRows, setRationRows] = useState<string[][]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalFiles: 0,
    totalRows: 0,
    duplicatesRemoved: 0,
    fieldsNormalized: 0,
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
            const headers = parseCSVLine(lines[0]);
            const rows = lines.slice(1).map((l) => parseCSVLine(l));
            parsed.push({ fileName: file.name, headers, rows });
          }
        } else if (/\.xlsx?$/i.test(file.name)) {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf);
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (raw.length > 0) {
            const headers = (raw[0] as unknown[]).map((h) =>
              String(h ?? "").trim(),
            );
            const rows = raw
              .slice(1)
              .filter((r) =>
                (r as unknown[]).some((c) => String(c ?? "").trim() !== ""),
              )
              .map((r) =>
                headers.map((_, i) => String((r as unknown[])[i] ?? "").trim()),
              );
            parsed.push({ fileName: file.name, headers, rows });
          }
        }
      } catch (err) {
        console.error(`Failed to parse ${file.name}`, err);
      }
    }

    setFiles((prev) => [...prev, ...parsed]);
  }, []);

  /* ── merge all files ── */

  const mergeAndPreview = () => {
    const colMap = new Map<string, number>();
    files.forEach((f) =>
      f.headers.forEach((h) => {
        const key = h.toLowerCase().trim();
        if (!colMap.has(key)) colMap.set(key, colMap.size);
      }),
    );

    const headers = Array.from(colMap.keys()).map((h) =>
      h
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    );

    const rows: string[][] = [];
    files.forEach((f) => {
      const map = new Map<number, number>();
      f.headers.forEach((h, i) => {
        const idx = colMap.get(h.toLowerCase().trim());
        if (idx !== undefined) map.set(i, idx);
      });
      f.rows.forEach((row) => {
        const merged = new Array(headers.length).fill("");
        row.forEach((cell, i) => {
          const idx = map.get(i);
          if (idx !== undefined) merged[idx] = cell;
        });
        rows.push(merged);
      });
    });

    setMergedHeaders(headers);
    setMergedRows(rows);
    setStep("preview");
  };

  /* ── rationalize ── */

  const rationalize = () => {
    setStep("rationalize");
    setProcessing(true);

    setTimeout(() => {
      let normCount = 0;

      const normalized = mergedRows.map((row) =>
        row.map((cell) => {
          const original = cell;
          let c = cell.trim().replace(/\s+/g, " ");
          const lo = c.toLowerCase();
          if (ABBREVIATIONS[lo]) c = ABBREVIATIONS[lo];
          if (c !== original) normCount++;
          return c;
        }),
      );

      const stdHeaders = mergedHeaders.map((h) =>
        h
          .trim()
          .replace(/\s+/g, " ")
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" "),
      );

      const seen = new Set<string>();
      const deduped: string[][] = [];
      let dupsRemoved = 0;
      normalized.forEach((row) => {
        const key = row.map((c) => c.toLowerCase()).join("|");
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(row);
        } else {
          dupsRemoved++;
        }
      });

      const cleaned = deduped.filter((row) => row.some((c) => c !== ""));
      dupsRemoved += deduped.length - cleaned.length;

      setRationHeaders(stdHeaders);
      setRationRows(cleaned);
      setStats({
        totalFiles: files.length,
        totalRows: mergedRows.length,
        duplicatesRemoved: dupsRemoved,
        fieldsNormalized: normCount,
      });
      setProcessing(false);
    }, 1500);
  };

  /* ── export helpers ── */

  const dlBlob = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const csv = [
      rationHeaders.map((h) => `"${h}"`).join(","),
      ...rationRows.map((r) =>
        r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    dlBlob(csv, "rationalized_procurement_data.csv", "text/csv");
  };

  const exportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([rationHeaders, ...rationRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rationalized Data");
    XLSX.writeFile(wb, "rationalized_procurement_data.xlsx");
  };

  /* ── reset ── */

  const reset = () => {
    setFiles([]);
    setMergedHeaders([]);
    setMergedRows([]);
    setRationHeaders([]);
    setRationRows([]);
    setStats({
      totalFiles: 0,
      totalRows: 0,
      duplicatesRemoved: 0,
      fieldsNormalized: 0,
    });
    setStep("upload");
  };

  /* ── drag handlers ── */

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files);
  };

  /* ═══════════════════════ render ═══════════════════════ */

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
                <button
                  onClick={() => done && setStep(s.key)}
                  disabled={!done}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${active ? "bg-[#F0B800] text-[#0a0a0f] shadow-md" : ""}
                    ${done ? "bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200" : ""}
                    ${!active && !done ? "bg-gray-100 text-gray-400" : ""}
                  `}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${active ? "bg-[#0a0a0f] text-[#F0B800]" : ""}
                    ${done ? "bg-emerald-500 text-white" : ""}
                    ${!active && !done ? "bg-gray-300 text-white" : ""}
                  `}
                  >
                    {done ? "\u2713" : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-6 sm:w-10 h-0.5 ${i < stepIdx ? "bg-emerald-400" : "bg-gray-200"}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── Card ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 animate-fade-in">
        {/* ─────────── UPLOAD ─────────── */}
        {step === "upload" && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Upload Procurement Data
              </h2>
              <p className="text-gray-500 mt-1">
                Upload Excel (.xlsx) or CSV files from your procurement sources
              </p>
            </div>

            {/* drop zone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                ${dragging ? "border-[#F0B800] bg-amber-50" : "border-gray-300 hover:border-[#F0B800] hover:bg-gray-50"}
              `}
            >
              <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-[#F0B800]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-700">
                Drag &amp; drop files here
              </p>
              <p className="text-sm text-gray-400 mt-1">or click to browse</p>
              <p className="text-xs text-gray-300 mt-3">
                Supports .xlsx, .xls, .csv
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) =>
                  e.target.files && ingestFiles(e.target.files)
                }
              />
            </div>

            {/* file list */}
            {files.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Uploaded Files ({files.length})
                </h3>
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-emerald-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {f.fileName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {f.rows.length} rows &middot; {f.headers.length}{" "}
                          columns
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles((prev) => prev.filter((_, j) => j !== i));
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                onClick={mergeAndPreview}
                disabled={files.length === 0}
                className="px-6 py-3 bg-[#F0B800] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#D4A200] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                Preview Merged Data &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ─────────── PREVIEW ─────────── */}
        {step === "preview" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Preview Merged Data
              </h2>
              <p className="text-gray-500 mt-1">
                {mergedRows.length} rows from {files.length} file(s) &mdash;
                review before rationalization
              </p>
            </div>

            <DataTable headers={mergedHeaders} rows={mergedRows} />

            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep("upload")}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
              >
                &larr; Back
              </button>
              <button
                onClick={rationalize}
                className="px-6 py-3 bg-[#F0B800] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#D4A200] transition-all shadow-sm"
              >
                Rationalize Data &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ─────────── RATIONALIZE ─────────── */}
        {step === "rationalize" && (
          <div>
            {processing ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
                  <svg
                    className="w-8 h-8 text-[#F0B800] animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Rationalizing Data&hellip;
                </h2>
                <p className="text-gray-500 mt-2">
                  Normalizing, deduplicating, and standardizing your procurement
                  data
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Rationalized Data
                  </h2>
                  <p className="text-gray-500 mt-1">
                    Your procurement data has been cleaned and standardized
                  </p>
                </div>

                {/* stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {(
                    [
                      {
                        label: "Files Processed",
                        value: stats.totalFiles,
                        cls: "bg-blue-50 text-blue-700",
                      },
                      {
                        label: "Original Rows",
                        value: stats.totalRows,
                        cls: "bg-gray-100 text-gray-700",
                      },
                      {
                        label: "Duplicates Removed",
                        value: stats.duplicatesRemoved,
                        cls: "bg-red-50 text-red-600",
                      },
                      {
                        label: "Fields Normalized",
                        value: stats.fieldsNormalized,
                        cls: "bg-emerald-50 text-emerald-700",
                      },
                    ] as const
                  ).map((s) => (
                    <div key={s.label} className={`rounded-lg p-4 ${s.cls}`}>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs font-medium opacity-70">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                <DataTable headers={rationHeaders} rows={rationRows} />

                <div className="mt-8 flex justify-between">
                  <button
                    onClick={() => setStep("preview")}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
                  >
                    &larr; Back
                  </button>
                  <button
                    onClick={() => setStep("export")}
                    className="px-6 py-3 bg-[#F0B800] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#D4A200] transition-all shadow-sm"
                  >
                    Export &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────── EXPORT ─────────── */}
        {step === "export" && (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900">
              Data Ready for Export
            </h2>
            <p className="text-gray-500 mt-1">
              {rationRows.length} standardized rows ready for download
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <button
                onClick={exportCSV}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#F0B800] text-[#0a0a0f] font-semibold rounded-lg hover:bg-[#D4A200] transition-all shadow-sm"
              >
                <DownloadIcon />
                Download CSV
              </button>
              <button
                onClick={exportExcel}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
              >
                <DownloadIcon />
                Download Excel
              </button>
            </div>

            <div className="mt-10 pt-6 border-t border-gray-200">
              <button
                onClick={reset}
                className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
              >
                Start over with new files
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ sub-components ═══════════════════════ */

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  const MAX = 100;
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              #
            </th>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, MAX).map((row, i) => (
            <tr
              key={i}
              className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
            >
              <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-[240px] truncate"
                  title={cell}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > MAX && (
        <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 text-center">
          Showing first {MAX} of {rows.length} rows
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
