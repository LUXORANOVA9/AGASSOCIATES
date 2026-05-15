import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "./TaskBoard";
import { GripVertical } from "lucide-react";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, isOverlay }) => {
  return (
    <div 
      className={`bg-white p-3 rounded-lg shadow-sm border border-gray-200 group flex items-start gap-2 ${isOverlay ? 'shadow-xl rotate-3 cursor-grabbing ring-2 ring-blue-500' : 'hover:shadow-md transition-shadow'}`}
    >
      <div className="mt-1 text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{task.title}</p>
        <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                {task.id.substring(0, 4)}
            </span>
        </div>
      </div>
    </div>
  );
};

export const SortableTask: React.FC<{ task: Task }> = ({ task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} />
    </div>
  );
};
