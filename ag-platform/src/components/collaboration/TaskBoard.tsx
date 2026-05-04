"use client";

import React, { useEffect, useState } from "react";
import { DndContext, closestCorners, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { supabase } from "../../hooks/useLivePresence";
import { SortableTask, TaskCard } from "./TaskCard";

export interface Task {
  id: string;
  title: string;
  status: string;
  position: number;
}

const COLUMNS = ["To Do", "In Progress", "Review", "Done"];

export const TaskBoard: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Load and subscribe
  useEffect(() => {
    let isMounted = true;
    
    // Load initial
    const loadTasks = async () => {
      const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('position');
      if (isMounted && data) setTasks(data as Task[]);
    };
    loadTasks();

    // Subscribe to DB updates for persistent changes
    const channelName = `board:${projectId}`;
    const channel = supabase.channel(channelName);
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (!isMounted) return;
        setTasks((prev) => {
            if (payload.eventType === 'INSERT') return [...prev, payload.new as Task];
            if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== payload.old.id);
            if (payload.eventType === 'UPDATE') {
                return prev.map(t => t.id === payload.new.id ? payload.new as Task : t);
            }
            return prev;
        });
      })
      // Broadcast for live drag feeling (optional enhancement)
      .on('broadcast', { event: 'drag_start' }, () => {
          // Could highlight card visually as "locked by user"
      })
      .subscribe();

    return () => {
        isMounted = false;
        supabase.removeChannel(channel);
    }
  }, [projectId]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);

    supabase.channel(`board:${projectId}`).send({
        type: 'broadcast',
        event: 'drag_start',
        payload: { taskId: active.id }
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === taskId);
    if (!activeTask) return;

    let newStatus = activeTask.status;
    let newPosition = activeTask.position;

    // Detect if dropped over a column directly or another task
    if (COLUMNS.includes(overId)) {
      newStatus = overId;
      newPosition = tasks.filter(t => t.status === overId).length; // basic append
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        newStatus = overTask.status;
        newPosition = overTask.position - 0.5; // Insert before. Better robust sorting math omitted for brevity.
      }
    }

    if (activeTask.status === newStatus && activeTask.position === newPosition) return; // No change

    // Optimistic Update
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t));

    // Persist
    const { error } = await supabase.from('tasks').update({ status: newStatus, position: newPosition }).eq('id', taskId);
    if (error) {
        console.error("Rollback. Conflict or error.", error);
        setTasks(previousTasks); // Rollback
    } else {
        // Also log activity optimally
        await supabase.from('activities').insert({ project_id: projectId, action: 'status_changed', target: activeTask.title }).select('id').single();
    }
  };

  return (
    <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-6 overflow-x-auto pb-4 h-full">
        {COLUMNS.map((columnInfo) => (
          <BoardColumn key={columnInfo} title={columnInfo} tasks={tasks.filter(t => t.status === columnInfo)} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};

// --- Subcomponents within same file for simplicity ---

function BoardColumn({ title, tasks }: { title: string, tasks: Task[] }) {
    const sortedTasks = [...tasks].sort((a,b) => a.position - b.position);
    
    return (
      <div className="bg-gray-50 flex flex-col w-80 rounded-xl flex-shrink-0 border border-gray-200" id={title}>
        <div className="p-3 border-b border-gray-200 font-semibold text-gray-700 flex justify-between items-center bg-white rounded-t-xl">
           {title} <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{tasks.length}</span>
        </div>
        <div className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto min-h-[150px]">
          <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {sortedTasks.map(task => (
              <SortableTask key={task.id} task={task} />
            ))}
          </SortableContext>
        </div>
      </div>
    );
}
