import { useState } from "react";
import { Sparkles, Plus, Loader2 } from "lucide-react";

interface SmartTaskSuggestionsProps {
  brief: string; // The project brief text
  existingTasks: any[]; // Existing task titles/descriptions
  orgId: string;
  onAddTasks: (tasks: any[]) => void;
}

export function SmartTaskSuggestions({ brief, existingTasks, orgId, onAddTasks }: SmartTaskSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSuggest = async () => {
    setIsLoading(true);
    setError("");
    setSuggestions([]);

    try {
      const res = await fetch("/api/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, existingTasks, orgId })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setSuggestions(data.tasks || []);
    } catch (err: any) {
      setError(err.message || "Failed to load suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAll = () => {
    onAddTasks(suggestions);
    setSuggestions([]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-semibold text-gray-900">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Smart Task Breakdowns
        </div>
        <button
          onClick={handleSuggest}
          disabled={isLoading || !brief}
          className="text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1.5 rounded-md font-medium transition disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</span>
          ) : "Suggest Tasks"}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {suggestions.length > 0 && (
        <div>
          <ul className="space-y-3 mb-4">
            {suggestions.map((task, idx) => (
              <li key={idx} className="p-3 border border-gray-100 rounded-lg bg-gray-50 flex flex-col gap-1">
                <div className="flex justify-between">
                   <strong className="text-sm text-gray-800">{task.title}</strong>
                   <span className={`text-xs px-2 py-0.5 rounded-full ${task.priority === 'High' ? 'bg-red-100 text-red-700' : task.priority === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                     {task.priority || 'Medium'}
                   </span>
                </div>
                <p className="text-xs text-gray-600">{task.description}</p>
                <div className="text-xs text-gray-500 mt-1 flex gap-3">
                   <span>Wait: {task.estimatedHours} hrs</span>
                </div>
              </li>
            ))}
          </ul>
          <button 
            onClick={handleAddAll}
            className="w-full flex justify-center items-center gap-2 bg-gray-900 hover:bg-black text-white py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" /> Add All to Board
          </button>
        </div>
      )}
    </div>
  );
}
