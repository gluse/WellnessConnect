import { Button } from "@/components/ui/button";

interface RoleSwitcherProps {
  currentRole: "seeker" | "provider";
  onRoleChange: (role: "seeker" | "provider") => void;
}

export default function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
  return (
    <div className="bg-neutral-100 p-1 rounded-lg flex">
      <Button
        variant={currentRole === "seeker" ? "default" : "ghost"}
        size="sm"
        onClick={() => onRoleChange("seeker")}
        className="px-3 py-1 text-sm font-medium"
      >
        Find Services
      </Button>
      <Button
        variant={currentRole === "provider" ? "default" : "ghost"}
        size="sm"
        onClick={() => onRoleChange("provider")}
        className="px-3 py-1 text-sm font-medium"
      >
        My Services
      </Button>
    </div>
  );
}
