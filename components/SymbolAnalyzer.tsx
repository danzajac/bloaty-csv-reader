"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  UploadCloud,
  Plus,
  Minus,
} from "lucide-react";
import Papa from "papaparse";

interface TreeNode {
  name: string;
  size: number;
  children: Record<string, TreeNode>;
  fullPath?: string;
  originalSymbol?: string;
  instantiations?: number;
}

interface TreeViewProps {
  data: TreeNode;
  level?: number;
  originalSymbol?: string;
  totalSize?: number;
  siblingCount?: number;
  defaultExpanded?: boolean;
  minSize?: number;
}

interface CSVRow {
  symbols: string;
  vmsize: number;
  instantiations: number;
}

interface SizeSliderProps {
  minSize: number;
  maxSize: number;
  currentMin: number;
  setCurrentMin: (value: number) => void;
}

interface CategoryStats {
  size: number;
  count: number;
  percentage: number;
}

interface SymbolGroup {
  name: string;
  size: number;
  count: number;
  originalSymbols: string[];
  instantiations: number;
  children: Record<string, TreeNode>;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const categorizeSymbol = (fullPath: string | undefined): string => {
  if (!fullPath || typeof fullPath !== "string") return "Other";

  // SYS-V symbols
  if (
    fullPath.match(/^\[.*\]/) ||
    fullPath.includes("__") ||
    fullPath.match(/\.dynsym$/) ||
    fullPath.match(/^_[A-Z_]/) ||
    fullPath.match(/_Prototype__/)
  ) {
    return "SYS-V";
  }

  // Rust symbols
  if (
    fullPath.match(/h[0-9a-f]{16}/) ||
    fullPath.match(/_rs::/) ||
    fullPath.match(/^rust_/) ||
    fullPath.match(/::_\$|::[a-z0-9]{2}_/) ||
    fullPath.match(/\$u20\$/) ||
    fullPath.match(/\$LT\$|\$GT\$/) ||
    fullPath.includes("lol_html")
  ) {
    return "Rust";
  }

  // C++ symbols
  if (
    fullPath.includes("::") ||
    fullPath.match(/<.*>/) ||
    fullPath.includes("namespace") ||
    fullPath.match(/^[A-Z][^.]*_t$/)
  ) {
    return "C++";
  }

  // Zig symbols
  if (fullPath.includes(".")) {
    return "Zig";
  }

  return "Other";
};

const TreeView: React.FC<TreeViewProps> = ({
  data,
  level = 0,
  originalSymbol = "",
  totalSize = 0,
  siblingCount = 0,
  defaultExpanded = undefined,
  minSize = 0,
}): JSX.Element => {
  const hasChildren = data.children && Object.keys(data.children).length > 0;
  const [expanded, setExpanded] = useState(
    typeof defaultExpanded === "boolean"
      ? defaultExpanded
      : level === 0
      ? siblingCount < 5
      : true
  );
  const indent = level * 20;
  const symbolForCategorization = originalSymbol || data.fullPath || data.name;
  const category = categorizeSymbol(symbolForCategorization);
  let categoryClasses = "";
  if (category === "C++") categoryClasses += "bg-blue-100 text-blue-800";
  if (category === "Zig") categoryClasses += "bg-yellow-100 text-yellow-800";
  if (category === "Rust") categoryClasses += "bg-red-100 text-red-800";
  if (category === "SYS-V") categoryClasses += "bg-purple-100 text-purple-800";
  if (category === "Other") categoryClasses += "bg-gray-100 text-gray-800";

  return (
    <div>
      <div
        className="flex items-center py-1 hover:bg-gray-50 cursor-pointer"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )
        ) : (
          <span className="w-4" />
        )}
        <span className="flex-1 flex items-center gap-2">
          {data.name}
          {(data.instantiations ?? 0) > 1 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {data.instantiations! + 1}×
            </span>
          ) : null}
          {level === 0 && (
            <span
              className={`
              inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
              ${categoryClasses}
            `}
            >
              {category}
            </span>
          )}
        </span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">{formatBytes(data.size)}</span>
          {totalSize > 0 && (
            <span className="text-gray-400 min-w-[4rem] text-right">
              {((data.size / totalSize) * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {Object.values(data.children)
            .sort((a, b) => b.size - a.size)
            .filter((child) => child.size >= minSize)
            .map((child, index, array) => (
              <TreeView
                key={
                  index +
                  "-" +
                  minSize +
                  "-" +
                  child.size +
                  "-" +
                  child.name +
                  "-" +
                  category
                }
                data={child}
                level={level + 1}
                originalSymbol={data.originalSymbol}
                totalSize={totalSize}
                siblingCount={array.length}
                defaultExpanded={false}
                minSize={minSize}
              />
            ))}
        </div>
      )}
    </div>
  );
};

const processSymbol = (symbol: string): string[] => {
  const cleanName = (str: string): string => {
    if (!str) return "";
    return str.trim();
  };

  let parts: string[] = [];

  while (
    symbol.startsWith("void ") ||
    symbol.startsWith("auto ") ||
    symbol.startsWith("int ") ||
    symbol.startsWith("char ") ||
    symbol.startsWith("long ") ||
    symbol.startsWith("short ") ||
    symbol.startsWith("unsigned ") ||
    symbol.startsWith("float ") ||
    symbol.startsWith("double ") ||
    symbol.startsWith("bool ") ||
    symbol.startsWith("void*") ||
    symbol.startsWith("char*") ||
    symbol.startsWith("const ") ||
    symbol.startsWith("volatile ") ||
    symbol.startsWith("restrict ")
  ) {
    symbol = symbol.slice(symbol.indexOf(" ") + 1);
  }

  if (symbol.startsWith("[")) {
    parts = [symbol];
  } else if (symbol.includes(".")) {
    parts = symbol.split(".").map(cleanName).filter(Boolean);
  } else if (symbol.includes("::")) {
    parts = symbol.split("::").map(cleanName).filter(Boolean);
  } else {
    parts = [cleanName(symbol)];
  }

  return parts;
};

const UploadState: React.FC<{
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ onFileUpload }) => (
  <div>
    <label className="block mb-2 text-lg font-bold text-gray-900">
      Bloaty CSV Reader
    </label>
    <div
      className="flex items-center justify-center w-full"
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
          const event = {
            target: {
              files: [file],
            },
          } as React.ChangeEvent<HTMLInputElement>;
          onFileUpload(event);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
    >
      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud className="w-16 h-16 mb-4 text-gray-500" />
          <p className="mb-2 text-sm text-gray-500">
            <span className="font-semibold">Click to upload</span> or drag and
            drop
          </p>
          <p className="text-xs text-gray-500">
            CSV file with symbols and sizes from bloaty
          </p>
        </div>
        <input
          type="file"
          className="hidden"
          accept=".csv"
          onChange={onFileUpload}
        />
      </label>
    </div>
  </div>
);

const mergeInstantiations = (symbols: TreeNode[]): TreeNode[] => {
  const groups = new Map<string, SymbolGroup>();

  const processNode = (node: TreeNode) => {
    // Only process leaf nodes
    if (Object.keys(node.children).length === 0) {
      // For Zig instantiations
      let nodeName = node.name;
      let baseName = nodeName
        .replaceAll(/__anon_([0-9]+)__struct_([0-9]+)$/g, "")
        .replaceAll(/__anon_([0-9]+)$/g, "");
      if (baseName != "") {
        const key = baseName;
        let group = groups.get(key);
        if (!group) {
          group = {
            name: baseName,
            size: 0,
            count: 0,
            originalSymbols: [],
            children: {},
            instantiations: 0,
          };
          groups.set(key, group);
        }

        group.size += node.size;
        group.count += 1;
        group.instantiations += 1;
        if (node.originalSymbol) {
          group.originalSymbols.push(node.originalSymbol);
        }
      }
    }

    // Recursively process children
    Object.values(node.children).forEach(processNode);
  };

  // Process all nodes to find mergeable leaves
  symbols.forEach(processNode);

  // Helper function to transform a node and its children
  const transformNode = (node: TreeNode): TreeNode => {
    // Transform children first
    const transformedChildren: Record<string, TreeNode> = {};
    for (const [key, child] of Object.entries(node.children)) {
      const result = transformNode(child);
      transformedChildren[result.name] = result;
    }
    const baseName = node.name
      .replaceAll(/__anon_[0-9]+$/gm, "")
      .replaceAll(/__anon_([0-9]+)__struct_([0-9]+)$/g, "");

    const group = groups.get(baseName);

    // Return node with transformed children
    return {
      ...node,
      children: transformedChildren,
      instantiations: group?.count || node.instantiations,
    };
  };

  // Transform all symbols
  return symbols.map(transformNode);
};

const StatsBar: React.FC<{
  hierarchy: TreeNode;
  activeFilters: Set<string>;
  toggleFilter: (category: string) => void;
}> = ({ hierarchy, activeFilters, toggleFilter }) => {
  const stats = new Map<string, CategoryStats>();
  let totalCount = 0;

  // Calculate stats by traversing the entire tree
  const calculateStats = (node: TreeNode) => {
    if (!node.children || Object.keys(node.children).length === 0) {
      const category = categorizeSymbol(node.originalSymbol);
      if (!stats.has(category)) {
        stats.set(category, { size: 0, count: 0, percentage: 0 });
      }
      const stat = stats.get(category)!;
      stat.size += node.size;
      stat.count += 1;
      totalCount += 1;
    } else {
      Object.values(node.children).forEach(calculateStats);
    }
  };

  calculateStats(hierarchy);

  // Calculate percentages
  stats.forEach((stat) => {
    stat.percentage = (stat.size / hierarchy.size) * 100;
  });

  return (
    <div className="mb-6 space-y-2">
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>Total Size: {formatBytes(hierarchy.size)}</span>
        <span>Symbols: {totalCount}</span>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {["C++", "Zig", "Rust", "SYS-V", "Other"].map((category) => {
          const stat = stats.get(category) || {
            size: 0,
            count: 0,
            percentage: 0,
          };
          let bgColor = "bg-gray-100 hover:bg-gray-200";
          let textColor = "text-gray-800";

          if (category === "C++") {
            bgColor = activeFilters.has(category)
              ? "bg-blue-500"
              : "bg-blue-100 hover:bg-blue-200";
            textColor = activeFilters.has(category)
              ? "text-white"
              : "text-blue-800";
          } else if (category === "Zig") {
            bgColor = activeFilters.has(category)
              ? "bg-yellow-500"
              : "bg-yellow-100 hover:bg-yellow-200";
            textColor = activeFilters.has(category)
              ? "text-white"
              : "text-yellow-800";
          } else if (category === "Rust") {
            bgColor = activeFilters.has(category)
              ? "bg-red-500"
              : "bg-red-100 hover:bg-red-200";
            textColor = activeFilters.has(category)
              ? "text-white"
              : "text-red-800";
          } else if (category === "SYS-V") {
            bgColor = activeFilters.has(category)
              ? "bg-purple-500"
              : "bg-purple-100 hover:bg-purple-200";
            textColor = activeFilters.has(category)
              ? "text-white"
              : "text-purple-800";
          }

          return (
            <button
              key={category}
              onClick={() => toggleFilter(category)}
              className={`${bgColor} ${textColor} rounded-lg p-3 text-sm text-left transition-colors duration-200`}
            >
              <div className="font-medium">{category}</div>
              <div className="mt-1 space-y-1">
                <div>{formatBytes(stat.size)}</div>
                <div className="text-xs opacity-75">
                  {stat.count} symbols ({stat.percentage.toFixed(1)}%)
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FilterButtons: React.FC<{
  setSearchTerm: (value: string) => void;
  activeFilters: Set<string>;
  toggleFilter: (category: string) => void;
}> = ({ setSearchTerm, activeFilters, toggleFilter }) => (
  <div className="space-y-4 mb-4">
    <div className="w-full">
      <input
        type="text"
        placeholder="Search symbols..."
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:outline-none focus:border-blue-500"
      />
    </div>
  </div>
);

const SizeSlider: React.FC<SizeSliderProps> = ({
  minSize,
  maxSize,
  currentMin,
  setCurrentMin,
}) => {
  const step = Math.max(1, Math.floor(maxSize / 1000));

  const increment = () => {
    setCurrentMin(Math.min(maxSize, currentMin + step));
  };

  const decrement = () => {
    setCurrentMin(Math.max(minSize, currentMin - step));
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">
          Minimum Size: {formatBytes(currentMin)}
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={decrement}
            className="p-1 rounded hover:bg-gray-100"
            title="Decrease minimum size"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={increment}
            className="p-1 rounded hover:bg-gray-100"
            title="Increase minimum size"
          >
            <Plus size={16} />
          </button>
          <span className="text-sm text-gray-500 ml-2">
            Max: {formatBytes(maxSize)}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={minSize}
        max={maxSize}
        step={step}
        value={currentMin}
        onChange={(e) => setCurrentMin(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
};

const RecentFiles: React.FC<{
  onFileSelect: (file: File) => void;
  currentFile?: string;
}> = ({ onFileSelect, currentFile }) => {
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [fileHandles, setFileHandles] = useState<
    Map<string, FileSystemFileHandle>
  >(new Map());

  useEffect(() => {
    const loadRecentFiles = async () => {
      try {
        const root = await navigator.storage.getDirectory();
        const dirHandle = await root.getDirectoryHandle("recent-files", {
          create: true,
        });

        const files = new Map<string, FileSystemFileHandle>();
        const fileNames: string[] = [];

        const entries = dirHandle.entries();
        for await (const [name, handle] of entries) {
          if (
            handle.kind === "file" &&
            handle instanceof FileSystemFileHandle
          ) {
            const permission = await handle.queryPermission({ mode: "read" });
            if (permission === "granted") {
              files.set(name, handle);
              fileNames.push(name);
            }
          }
        }

        setFileHandles(files);
        setRecentFiles(fileNames);
      } catch (err) {
        console.error("Error loading recent files:", err);
      }
    };

    if (typeof window !== "undefined" && "storage" in navigator) {
      loadRecentFiles();
    }
  }, []);

  const handleFileClick = async (filename: string) => {
    const handle = fileHandles.get(filename);
    if (!handle) return;

    try {
      const permission = await handle.queryPermission({ mode: "read" });
      if (permission === "denied") {
        const newPermission = await handle.requestPermission({ mode: "read" });
        if (newPermission === "denied") {
          console.error("Permission denied to read file");
          return;
        }
      }

      const file = await handle.getFile();
      onFileSelect(file);
    } catch (err) {
      console.error("Error loading file:", err);
    }
  };

  if (recentFiles.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Files</h3>
      <div className="flex flex-wrap gap-2">
        {recentFiles.map((filename) => (
          <button
            key={filename}
            onClick={() => handleFileClick(filename)}
            className={`
              text-sm px-3 py-1 rounded-full
              ${
                currentFile === filename
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }
            `}
          >
            {filename}
          </button>
        ))}
      </div>
    </div>
  );
};

const SymbolAnalyzer: React.FC = (): JSX.Element => {
  const [hierarchy, setHierarchy] = useState<TreeNode | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [minSize, setMinSize] = useState(1024 * 10);
  const [maxSize, setMaxSize] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>();

  const toggleFilter = (category: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(category)) {
      newFilters.delete(category);
    } else {
      newFilters.add(category);
    }
    setActiveFilters(newFilters);
  };

  const matchesFilters = (node: TreeNode): boolean => {
    // Size filter
    if (node.size < minSize) return false;

    const category = categorizeSymbol(node.originalSymbol);
    const matchesCategory =
      activeFilters.size === 0 || activeFilters.has(category);

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (node.fullPath || node.originalSymbol || node.name)
        .toLowerCase()
        .includes(searchLower);

    return matchesCategory && matchesSearch;
  };

  const saveToRecent = async (file: File) => {
    if (typeof window === "undefined" || !("storage" in navigator)) return;

    try {
      await navigator.storage.persist();

      // Get directory handle
      const root = await navigator.storage.getDirectory();

      const recentFiles = await root.getDirectoryHandle("recent-files", {
        create: true,
      });

      // Get file handle and create writable
      const fileHandle = await recentFiles.getFileHandle(
        file.name || "output.csv",
        {
          create: true,
        }
      );

      // Copy the file contents
      const writable = await fileHandle.createWritable({
        keepExistingData: false,
      });
      await writable.write(await file.arrayBuffer());
      await writable.close();
    } catch (err) {
      console.error("Error saving recent file:", err);
    }
  };

  const processFile = async (file: File) => {
    setCurrentFile(file.name);
    const [_, text] = await Promise.all([saveToRecent(file), file.text()]);

    Papa.parse<CSVRow>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        try {
          let sortedSymbols = results.data
            .filter((row) => {
              if (typeof row !== "object") return false;
              if (!row.symbols || typeof row.symbols !== "string") return false;
              if (!row.vmsize || typeof row.vmsize === "number") {
                return true;
              }

              return false;
            })
            .sort((a, b) =>
              b.vmsize === a.vmsize
                ? a.symbols.localeCompare(b.symbols)
                : b.vmsize - a.vmsize
            );
          let dedupedSymbols = new Map<string, CSVRow>();
          for (const symbol of sortedSymbols) {
            let name = symbol.symbols
              .replaceAll(/__struct_([0-9]+)$/gm, "")
              .replaceAll(/__anon_([0-9]+)__struct_([0-9]+)$/g, "")
              .replaceAll(/__anon_([0-9]+)$/gm, "");

            const existing = dedupedSymbols.get(name);

            if (existing) {
              existing.vmsize += symbol.vmsize;
              existing.instantiations += (symbol.instantiations ?? 0) + 1;
            } else {
              if (!(name === "_" && name !== symbol.symbols)) {
                symbol.symbols = name;
              }
              symbol.instantiations ??= 0;

              dedupedSymbols.set(symbol.symbols, symbol);
            }
          }
          sortedSymbols = Array.from(dedupedSymbols.values());

          // Find max size
          const maxVmSize = sortedSymbols.reduce(
            (max, symbol) => Math.max(max, symbol.vmsize),
            0
          );
          setMaxSize(maxVmSize);
          setMinSize(1024 * 10);

          // Build hierarchy
          const root: TreeNode = {
            name: "root",
            size: 0,
            children: {},
            instantiations: 0,
          };

          sortedSymbols.forEach((symbol) => {
            try {
              const parts = processSymbol(symbol.symbols);
              let current = root;
              let path = "";

              parts.forEach((part, i) => {
                if (!part) return;
                path = path ? `${path}::${part}` : part;

                if (!current?.children?.[part]) {
                  current.children ??= {};

                  current.children[part] = {
                    name: part,
                    size: 0,
                    children: {},
                    fullPath: path,
                    originalSymbol: symbol.symbols,
                    instantiations: 0,
                  };
                }

                current = current.children[part];
                if (i === parts.length - 1) {
                  current.size += symbol.vmsize;
                  current.instantiations += symbol.instantiations;
                }
              });
            } catch (err) {
              console.warn("Error processing symbol:", symbol, err);
            }
          });

          // Calculate total sizes
          const calculateTotalSize = (node: TreeNode): number => {
            if (!node) return 0;
            node.size = node.size || 0;
            if (node.children) {
              node.size += Object.values(node.children).reduce(
                (sum, child) => sum + (calculateTotalSize(child) || 0),
                0
              );
            }
            return node.size;
          };

          calculateTotalSize(root);
          setHierarchy(root);
        } catch (err) {
          console.error("Error processing CSV data:", err);
        }
      },
      error: (error: Error) => {
        console.error("Error parsing CSV:", error);
      },
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div>
      {!hierarchy ? (
        <>
          <title>Bloaty Symbol Analyzer</title>
          <UploadState onFileUpload={handleFileUpload} />
          <RecentFiles onFileSelect={processFile} currentFile={currentFile} />
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <title>{currentFile} | Bloaty Symbol Analyzer</title>
            <div
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".csv";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    processFile(file);
                  }
                };
                input.click();
              }}
              className="flex items-center gap-2"
            >
              <h2 className="text-lg font-medium text-gray-900">
                Bloaty CSV Reader: {currentFile}
              </h2>
              <button className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100">
                <UploadCloud size={16} />
              </button>
            </div>
            <button
              onClick={(evt) => {
                evt.preventDefault();
                setHierarchy(null);
                setCurrentFile(undefined);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Change File
            </button>
          </div>
          <StatsBar
            hierarchy={hierarchy}
            activeFilters={activeFilters}
            toggleFilter={toggleFilter}
          />
          <FilterButtons
            setSearchTerm={setSearchTerm}
            activeFilters={activeFilters}
            toggleFilter={toggleFilter}
          />
          <SizeSlider
            minSize={0}
            maxSize={maxSize}
            currentMin={minSize}
            setCurrentMin={setMinSize}
          />

          <div
            className="max-h-[70vh] overflow-y-auto scrollbar-gutter-stable"
            style={{
              overscrollBehavior: "contain",
            }}
          >
            {Object.values(hierarchy.children)
              .sort((a, b) => b.size - a.size)
              .filter((child) => matchesFilters(child))
              .map((child, index, array) => (
                <TreeView
                  key={
                    index +
                    "-" +
                    minSize +
                    "-" +
                    child.size +
                    "-" +
                    child.name +
                    "-" +
                    categorizeSymbol(child.originalSymbol)
                  }
                  data={child}
                  minSize={minSize}
                  level={0}
                  originalSymbol={child.originalSymbol}
                  totalSize={hierarchy.size}
                  siblingCount={array.length}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
};

export { SymbolAnalyzer };
