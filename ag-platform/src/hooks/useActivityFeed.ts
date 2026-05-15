import { useEffect, useState } from "react";
import { supabase } from "./useLivePresence";

export interface Activity {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  target?: string;
  created_at: string;
  users?: {
      email: string;
  }
}

export function useActivityFeed(projectId: string) {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!projectId) return;
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadActivities = async () => {
      // Intial Load
      const { data } = await supabase
        .from('activities')
        .select(`
          *,
          users:user_id ( email )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (isMounted && data) {
        setActivities(data as Activity[]);
      }

      if (!isMounted) return;

      // Realtime Load (Inserts only typically for activity feeds)
      const channelPattern = `activities:project:${projectId}`;
      channel = supabase.channel(channelPattern);
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'activities',
            filter: `project_id=eq.${projectId}`
          },
          async (payload) => {
            if (!isMounted) return;
            const newRecord = payload.new as Activity;
            
            // To get relations like email, we might need an extra fetch for realtime records
            // Or just fetch the profile if the user table works like that.
            // For simplicity, fetch the user record manually if missing
            const { data: userData } = await supabase.from('users').select('email').eq('id', newRecord.user_id).single();
            
            const detailedRecord = {
                ...newRecord,
                users: userData ? { email: userData.email } : { email: 'Unknown' }
            };

            setActivities(prev => [detailedRecord, ...prev]);
          }
        )
        .subscribe();
    }
    
    loadActivities();

    return () => {
      isMounted = false;
      if (channel) {
          supabase.removeChannel(channel);
      } else {
          supabase.removeChannel(supabase.channel(`activities:project:${projectId}`));
      }
    };
  }, [projectId]);

  return { activities };
}
