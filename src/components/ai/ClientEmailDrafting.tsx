import { useState } from "react";
import { Mail, Send, Sparkles, Loader2 } from "lucide-react";

export function ClientEmailDrafting({ orgId }: { orgId: string }) {
  const [emailType, setEmailType] = useState("Status Update");
  const [contextData, setContextData] = useState("");
  const [draft, setDraft] = useState("");
  const [recipient, setRecipient] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const generateDraft = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_type: emailType, context_data: contextData, orgId })
      });
      const data = await res.json();
      if (res.ok) setDraft(data.draft);
      else alert(data.error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!recipient || !draft) return;
    setSending(true);
    try {
      const res = await fetch("/api/ai/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient, subject: `Project ${emailType}`, body: draft })
      });
      if (res.ok) {
        alert("Email sent successfully!");
        setDraft("");
      } else {
        const d = await res.json();
        alert(d.error?.message || "Failed to send");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 font-semibold text-gray-900 mb-4 border-b pb-2 border-gray-100">
        <Mail className="w-5 h-5 text-blue-500" />
        Client Comm Draft
      </div>

      <div className="space-y-3">
        <select 
          value={emailType}
          onChange={(e) => setEmailType(e.target.value)}
          className="w-full border-gray-200 border p-2 rounded text-sm"
        >
          <option>Status Update</option>
          <option>Proposal</option>
          <option>Issue Escalation</option>
          <option>Meeting Follow-up</option>
        </select>

        <textarea
          placeholder="Enter raw context, bullets, or thoughts here..."
          value={contextData}
          onChange={(e) => setContextData(e.target.value)}
          rows={3}
          className="w-full border-gray-200 border p-2 rounded text-sm resize-none"
        />

        <button 
          onClick={generateDraft}
          disabled={isLoading || !contextData}
          className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2 rounded flex justify-center items-center gap-2 text-sm transition"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Professional Draft
        </button>

        {draft && (
           <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
             <input
               type="email"
               placeholder="Client Email Address"
               value={recipient}
               onChange={(e) => setRecipient(e.target.value)}
               className="w-full border-gray-200 border p-2 rounded text-sm"
             />
             <textarea 
               value={draft}
               onChange={(e) => setDraft(e.target.value)}
               rows={8}
               className="w-full border-gray-200 border p-2 rounded text-sm font-sans"
             />
             <button
               onClick={sendEmail}
               disabled={sending || !recipient || !draft}
               className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded flex items-center justify-center gap-2 text-sm transition"
             >
               {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
               Send via Resend
             </button>
           </div>
        )}
      </div>
    </div>
  );
}
