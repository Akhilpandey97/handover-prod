import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ThemeToggle = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "onClick">>(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { theme, setTheme } = useTheme();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className={cn("relative h-10 w-10 rounded-xl", className)}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        {...props}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  },
);

ThemeToggle.displayName = "ThemeToggle";
