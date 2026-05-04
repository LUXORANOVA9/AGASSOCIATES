import React from "react";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { formatDistanceToNow } from "date-fns";
import { History, FileText, CheckCircle } from "lucide-react";

export const ActivityFeed: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { activities } = useActivityFeed(projectId);

  const getIcon = (action: string) => {
    switch (action) {
      case 'status_changed': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'comment_added': return <FileText className="w-3.5 h-3.5 text-blue-500" />;
      default: return <History className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
           <History className="w-4 h-4 text-gray-500" />
           Project Activity
        </h3>
      </div>
      <div className="p-2 max-h-[400px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No activity yet</div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => (
              <div key={activity.id} className="p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                <div className="flex gap-3">
                  <div className="mt-1 w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                    {getIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">
                      <span className="font-semibold">{activity.users?.email.split('@')[0]}</span>
                      {' '}{activity.action.replace('_', ' ')}
                      {activity.target && <span className="font-medium text-gray-900">: {activity.target}</span>}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
