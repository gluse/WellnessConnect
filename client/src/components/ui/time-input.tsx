import * as React from "react";
import { Input } from "@/components/ui/input";

export const timePattern = "([01][0-9]|2[0-3]):[0-5][0-9]";
export const isTime24 = (value: string) => new RegExp(`^${timePattern}$`).test(value);

// Native time controls choose their visible clock from the browser/OS. A text
// field makes HH:mm explicit while keeping the existing canonical API value.
export const TimeInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<typeof Input>, "type">>(
  (props, ref) => <Input {...props} ref={ref} type="text" inputMode="text" dir="ltr"
    placeholder="HH:mm" pattern={timePattern} maxLength={5} data-time-input="24h" />,
);
TimeInput.displayName = "TimeInput";
