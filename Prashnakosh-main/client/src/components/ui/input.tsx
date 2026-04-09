import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border px-3 py-2 text-base transition-all duration-200",
          "bg-[#F1F5F9] dark:bg-[#1E293B]",
          "border-[#CBD5E1] dark:border-[#334155]",
          "text-[#0F172A] dark:text-[#F1F5F9]",
          "placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B]",
          "focus-visible:outline-none focus-visible:border-[#22C1C3] focus-visible:ring-2 focus-visible:ring-[rgba(34,193,195,0.25)]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
