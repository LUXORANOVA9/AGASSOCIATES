"use client";

import React, { useState } from "react";
import { useNotifications } from "../../hooks/useNotifications";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition text-gray-600"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden transform opacity-100 scale-100 transition-all origin-top-right">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                You're all caught up!
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((notif) => (
                  <li 
                    key={notif.id} 
                    className={`p-3 hover:bg-gray-50 cursor-pointer flex gap-3 relative ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                    onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                        if (notif.link) window.location.href = notif.link;
                    }}
                  >
                    {!notif.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.is_read ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notif.is_read && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                         className="flex-shrink-0 text-blue-500 hover:bg-blue-100 p-1 rounded-full h-fit mt-1"
                         title="Mark as read"
                       >
                         <Check className="w-3 h-3" />
                       </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
