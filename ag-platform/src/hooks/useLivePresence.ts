import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PresenceUser {
  user_id: string;
  email: string;
  avatar_url?: string;
  online_at: string;
}

export function useLivePresence(projectId: string) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    let userId: string | undefined;
    let userEmail: string | undefined;

    const channel = supabase.channel(`presence:project:${projectId}`, {
      config: {
        presence: {
          key: '',
        },
      },
    });

    const initPresence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      if (!isMounted) return;
      
      userId = session.user.id;
      userEmail = session.user.email;

      channel
        .on("presence", { event: "sync" }, () => {
          if (!isMounted) return;
          const newState = channel.presenceState();
          
          const uniqueUsers = new Map<string, PresenceUser>();
          Object.values(newState).forEach((presenceKeys) => {
            presenceKeys.forEach((presence: any) => {
              if (!uniqueUsers.has(presence.user_id)) {
                uniqueUsers.set(presence.user_id, presence as PresenceUser);
              }
            });
          });
          
          setUsers(Array.from(uniqueUsers.values()));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && userId) {
            await channel.track({
              user_id: userId,
              email: userEmail,
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    initPresence();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { users };
}
