import * as React from "react";

import { cn } from "@/lib/utils";

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
    ),
);
FormItem.displayName = "FormItem";

export { FormItem };
