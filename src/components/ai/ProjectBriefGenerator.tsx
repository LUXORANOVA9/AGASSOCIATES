import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { Sparkles, FileText, Loader2, StopCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ProjectBriefGeneratorProps {
  orgId: string;
}

export function ProjectBriefGenerator({ orgId }: ProjectBriefGeneratorProps) {
  const [projectData, setProjectData] = useState({
    project_name: "",
    client_name: "",
    scope_description: "",
    deliverables: ""
  });

  const { completion, complete, isLoading, stop, error } = useCompletion({
    api: '/api/ai/generate-brief',
    onError: (err) => {
      console.error(err);
    }
  });

  const handleGenerate = () => {
    complete(projectData.scope_description, {
      body: {
        project_name: projectData.project_name,
        client_name: projectData.client_name,
        scope_description: projectData.scope_description,
        deliverables: projectData.deliverables.split(',').map(d => d.trim()).filter(Boolean),
        orgId
      }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-sm w-full max-w-4xl mx-auto mt-6">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-semibold text-gray-900">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Project Brief Generator
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-[600px] max-h-[80vh]">
        {/* Input Form */}
        <div className="w-full md:w-1/3 p-4 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Project Name</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-200 rounded text-gray-800"
              value={projectData.project_name}
              onChange={e => setProjectData({...projectData, project_name: e.target.value})}
              placeholder="e.g. Acme Website Redesign"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Client Name</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-200 rounded text-gray-800"
              value={projectData.client_name}
              onChange={e => setProjectData({...projectData, client_name: e.target.value})}
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Scope Description</label>
            <textarea
              className="w-full p-2 border border-gray-200 rounded text-gray-800"
              rows={4}
              value={projectData.scope_description}
              onChange={e => setProjectData({...projectData, scope_description: e.target.value})}
              placeholder="Briefly describe the project goals..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Deliverables (comma separated)</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-200 rounded text-gray-800"
              value={projectData.deliverables}
              onChange={e => setProjectData({...projectData, deliverables: e.target.value})}
              placeholder="Figma files, React codebase, Documentation"
            />
          </div>
          
          <div className="mt-auto">
            {error && (
              <div className="text-red-500 text-xs mb-3 bg-red-50 p-2 rounded">
                Error: {error.message.includes('402') ? 'AI Quota Exceeded' : error.message}
              </div>
            )}
            {!isLoading ? (
              <button 
                onClick={handleGenerate}
                disabled={!projectData.project_name || !projectData.scope_description}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 rounded flex items-center justify-center gap-2 transition"
              >
                <Sparkles className="w-4 h-4" /> Generate Brief
              </button>
            ) : (
              <button 
                onClick={stop}
                className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2 rounded flex items-center justify-center gap-2 transition"
              >
                <StopCircle className="w-4 h-4" /> Stop Generation
              </button>
            )}
          </div>
        </div>

        {/* Output Area */}
        <div className="w-full md:w-2/3 p-6 overflow-y-auto bg-white relative">
          {isLoading && !completion && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-purple-300" />
              <p>Analyzing project constraints & generating brief...</p>
            </div>
          )}
          
          {!isLoading && !completion && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <FileText className="w-12 h-12 mb-4 text-gray-200" />
              <p>Your generated brief will appear here.</p>
            </div>
          )}

          {completion && (
            <div className="prose prose-sm max-w-none text-gray-800 prose-headings:text-purple-900 prose-headings:font-semibold">
              <ReactMarkdown>{completion}</ReactMarkdown>
              {isLoading && (
                 <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1 align-middle"></span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
