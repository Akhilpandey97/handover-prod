import { currentUser } from "@/data/projects";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface UserProfileCardProps {
  pendingCount: number;
  activeCount: number;
}

export function UserProfileCard({ pendingCount, activeCount }: UserProfileCardProps) {
  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className="p-6 border-b">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{currentUser.name}</h2>
          <p className="text-sm text-muted-foreground capitalize">{currentUser.role} Team</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="p-3 rounded-lg bg-pending/10 border border-pending/20">
          <p className="text-2xl font-bold text-pending">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending KT</p>
        </div>
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-2xl font-bold text-primary">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active Projects</p>
        </div>
      </div>
    </div>
  );
}
