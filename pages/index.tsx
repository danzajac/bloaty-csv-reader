import { SymbolAnalyzer } from "../components/SymbolAnalyzer";

export default function Page() {
  return (
    <div className="max-w-5xl mx-auto p-4">
      {/** TODO: use tailwind bun plugin once that's implemented. */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/tailwindcss@latest/dist/tailwind.min.css"
      />
      {/** TODO: use metadata api once that's implemented. */}
      <title>Bloaty Symbol Analyzer</title>

      <SymbolAnalyzer />

      <div className="mb-6 mt-20">
        <div className="rounded-lg border border-gray-200 bg-white p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
          <p className="text-gray-600 mb-4">
            To analyze your binary, first generate a CSV file using bloaty:
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-sm overflow-x-auto">
            <code>
              bloaty -d symbols -s file -n 100000 --demangle=full --domain=file
              --csv &lt;binary-file&gt;
            </code>
          </div>
          <p className="text-gray-600 mb-2">
            Don't have bloaty? Install it with Homebrew:
          </p>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
            <code>brew install bloaty</code>
          </div>
        </div>
      </div>
    </div>
  );
}
