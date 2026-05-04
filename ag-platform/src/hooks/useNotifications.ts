export interface Notification {
  id: string;
  user_id: string;
  type: 'task_assigned' | 'comment_mention' | 'invoice_overdue' | 'file_uploaded';
  message: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

import { useEffect, useState } from "react";
import { supabase } from "./useLivePresence"; // reuse the client

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let userId: string;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadNotifications = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      userId = session.user.id;

      // Load initial
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (isMounted && data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }

      if (!isMounted) return;

      // Subscribe to changes
      channel = supabase.channel(`notifications:user:${userId}`);
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!isMounted) return;
            const newNotif = payload.new as Notification;
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!isMounted) return;
            const updated = payload.new as Notification;
            setNotifications((prev) => 
               prev.map(n => n.id === updated.id ? updated : n)
            );
            
            // Recalculate unread count
            setUnreadCount(prev => prev - (updated.is_read ? 1 : 0));
          }
        )
        .subscribe();
    }

    loadNotifications();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    
    // Server update
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false);
    }
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
