import { useMemo, useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { CalendarDays, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ChecklistTask,
  useChecklistTaskMutations,
  useUpdateChecklistDueDate,
} from "@/hooks/useChecklistTasks";

interface Props {
  projectId: string;
  checklistItemId: string;
  dueDate?: string;
  tasks: ChecklistTask[];
  canEdit: boolean;
}

const formatDay = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "d MMM");
};

const isOverdue = (value?: string | null, completed?: boolean) => {
  if (!value || completed) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return isBefore(startOfDay(date), startOfDay(new Date()));
};

export const ChecklistItemTasks = ({ projectId, checklistItemId, dueDate, tasks, canEdit }: Props) => {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const { addTask, toggleTask, updateTask, deleteTask } = useChecklistTaskMutations(projectId);
  const updateDueDate = useUpdateChecklistDueDate();

  const doneCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const deadlineLabel = formatDay(dueDate);
  const deadlineOverdue = isOverdue(dueDate, false);

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    addTask.mutate({ checklistItemId, title });
    setNewTitle("");
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canEdit}
              className={cn(
                "h-7 gap-1.5 rounded-full px-2.5 text-xs font-semibold",
                deadlineOverdue && "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {deadlineLabel ? `Due ${deadlineLabel}` : "Set deadline"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[120]" align="start">
            <Calendar
              mode="single"
              selected={dueDate ? new Date(dueDate) : undefined}
              onSelect={(date) =>
                updateDueDate.mutate({
                  checklistItemId,
                  dueDate: date ? format(date, "yyyy-MM-dd") : null,
                })
              }
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {dueDate ? (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={() => updateDueDate.mutate({ checklistItemId, dueDate: null })}
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear deadline
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        {tasks.length > 0 ? (
          <span className="text-xs font-medium text-muted-foreground">
            {doneCount}/{tasks.length} tasks done
          </span>
        ) : null}

        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs font-semibold text-primary"
            onClick={() => setAdding((prev) => !prev)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </Button>
        ) : null}
      </div>

      {tasks.length > 0 ? (
        <ul className="space-y-1">
          {tasks.map((task) => {
            const taskDue = formatDay(task.due_date);
            const overdue = isOverdue(task.due_date, task.completed);
            return (
              <li
                key={task.id}
                className="group flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5"
              >
                <Checkbox
                  checked={task.completed}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => toggleTask.mutate({ id: task.id, completed: Boolean(checked) })}
                  className="h-4 w-4"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    task.completed && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </span>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!canEdit}
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        overdue
                          ? "bg-destructive/10 text-destructive"
                          : taskDue
                            ? "bg-muted text-muted-foreground"
                            : "text-muted-foreground opacity-0 group-hover:opacity-100",
                      )}
                    >
                      {taskDue || "Due date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[120]" align="end">
                    <Calendar
                      mode="single"
                      selected={task.due_date ? new Date(task.due_date) : undefined}
                      onSelect={(date) =>
                        updateTask.mutate({ id: task.id, dueDate: date ? format(date, "yyyy-MM-dd") : null })
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => deleteTask.mutate(task.id)}
                    className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {adding && canEdit ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAdd();
              }
              if (event.key === "Escape") setAdding(false);
            }}
            placeholder="Task name, press Enter to add"
            className="h-8 text-sm"
          />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={!newTitle.trim()}>
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
};
