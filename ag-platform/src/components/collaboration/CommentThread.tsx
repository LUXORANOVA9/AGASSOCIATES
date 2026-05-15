"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../hooks/useLivePresence";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";

export interface Comment {
  id: string;
  project_id: string;
  task_id?: string;
  user_id: string;
  content: string;
  created_at: string;
  users?: { email: string };
}

interface CommentThreadProps {
  projectId: string;
  taskId?: string;
}

export const CommentThread: React.FC<CommentThreadProps> = ({ projectId, taskId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const init = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setUserId(session.user.id);

        // Build query
        let query = supabase.from('comments').select('*, users:user_id(email)').eq('project_id', projectId).order('created_at', { ascending: true });
        if (taskId) query = query.eq('task_id', taskId);
        else query = query.is('task_id', null);

        const { data } = await query;
        if (isMounted && data) setComments(data as Comment[]);

        if (!isMounted) return;

        // Real-time subscription
        let filter = `project_id=eq.${projectId}`;
        // Supabase filters require explicit matching. We can filter further client-side if needed
        channel = supabase.channel(`comments:${projectId}:${taskId || 'general'}`);
        channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter }, async (payload) => {
              if (!isMounted) return;
              const newRecord = payload.new as Comment;
              if (taskId && newRecord.task_id !== taskId) return;
              if (!taskId && newRecord.task_id) return;

              // Need to get the user email for UI
              const { data: uData } = await supabase.from('users').select('email').eq('id', newRecord.user_id).single();
              
              setComments(prev => [...prev, { ...newRecord, users: uData ? { email: uData.email } : { email: 'Unknown' } }]);
          })
          .subscribe();
    }
    init();

    return () => {
        isMounted = false;
        if (channel) {
            supabase.removeChannel(channel);
        } else {
            // Unlikely fallback
            supabase.removeChannel(supabase.channel(`comments:${projectId}:${taskId || 'general'}`));
        }
    }
  }, [projectId, taskId]);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || !userId) return;

      const optimisticComment: Comment = {
          id: `temp-${Date.now()}`,
          project_id: projectId,
          task_id: taskId,
          user_id: userId,
          content: inputValue,
          created_at: new Date().toISOString(),
          users: { email: 'You' }
      };

      setComments(prev => [...prev, optimisticComment]);
      const valueToSend = inputValue;
      setInputValue("");

      const { data, error } = await supabase.from('comments').insert({
          project_id: projectId,
          task_id: taskId,
          user_id: userId,
          content: valueToSend
      }).select('id, created_at').single();

      if (error) {
          // Revert on error
          setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      } else if (data) {
          // update ID
          setComments(prev => prev.map(c => c.id === optimisticComment.id ? { ...c, id: data.id, created_at: data.created_at } : c));
      }
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2 rounded-t-xl">
        <h3 className="font-semibold text-gray-900">Discussion</h3>
        <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{comments.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <p>No comments yet. Start the conversation!</p>
            </div>
        ) : comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 flex-shrink-0">
                <span className="text-xs font-semibold text-blue-700">
                   {(comment.users?.email || 'U').substring(0, 1).toUpperCase()}
                </span>
             </div>
             <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                 <div className="flex items-center justify-between mb-1">
                     <span className="text-sm font-semibold text-gray-900">{comment.users?.email?.split('@')[0]}</span>
                     <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(comment.created_at))} ago</span>
                 </div>
                 {/* Primitive rich text logic handling mentions visually */}
                 <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {comment.content.split(' ').map((word, i) => 
                        word.startsWith('@') ? <span key={i} className="text-blue-600 font-medium bg-blue-50 px-1 rounded">{word} </span> : word + ' '
                    )}
                 </p>
             </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl">
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            <textarea 
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               placeholder="Write a comment... (use @ to mention)"
               className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none min-h-[44px] max-h-32"
               rows={1}
               onKeyDown={(e) => {
                   if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSubmit(e);
                   }
               }}
            />
            <button 
               type="submit"
               disabled={!inputValue.trim()}
               className="absolute right-2 bottom-2 p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition"
            >
                <Send className="w-4 h-4" />
            </button>
        </form>
      </div>
    </div>
  );
};
