import React from "react";
import { useLivePresence } from "../../hooks/useLivePresence";
import { Users } from "lucide-react";

export const LivePresence: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { users } = useLivePresence(projectId);

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user) => (
          <div
            key={user.user_id}
            className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-blue-600 text-xs font-semibold"
            title={user.email}
          >
            {user.email.charAt(0).toUpperCase()}
          </div>
        ))}
        {users.length > 3 && (
          <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-semibold">
            +{users.length - 3}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
        <Users className="w-3 h-3 text-blue-500" />
        <span className="font-medium text-blue-600">{users.length}</span> online
      </div>
    </div>
  );
};
