import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

export function SemanticProjectSearch({ orgId }: { orgId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/search-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, orgId })
      });
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 font-semibold text-gray-900 mb-4 border-b pb-2 border-gray-100">
        <Search className="w-5 h-5 text-indigo-500" />
        Semantic Project Search
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. E-commerce redesign for retail client..."
          className="flex-1 border p-2 rounded-md text-sm"
        />
        <button 
           type="submit" 
           disabled={isLoading || !query}
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </button>
      </form>

      {results.length > 0 && (
         <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Similar Projects</h4>
            {results.map((result, i) => (
               <div key={i} className="p-3 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-between">
                  <div>
                     <span className="font-semibold text-sm text-gray-900">Project #{result.project_id.substring(0,6)}</span>
                     <p className="text-xs text-gray-600 mt-1 line-clamp-2">{result.content}</p>
                  </div>
                  <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                     {(result.similarity * 100).toFixed(1)}% Match
                  </div>
               </div>
            ))}
         </div>
      )}
    </div>
  );
}
