import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash2, Clock, Calendar, Repeat, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { Availability, Service } from "@shared/schema";

type EditMode = "choose" | "this_occurrence" | "all_occurrences" | "edit";

interface ScheduleEditModalProps {
  schedule: Availability;
  clickedDate: Date;
  isRecurring: boolean;
  services: Service[];
  onSave: (data: {
    mode: "this_occurrence" | "all_occurrences" | "single";
    scheduleId: number;
    updates: any;
    newSpecificDate?: string;
  }) => void;
  onDelete: (data: {
    mode: "this_occurrence" | "all_occurrences" | "single";
    scheduleId: number;
    specificDate?: string;
  }) => void;
  onClose: () => void;
  isPending?: boolean;
}

export default function ScheduleEditModal({
  schedule,
  clickedDate,
  isRecurring,
  services,
  onSave,
  onDelete,
  onClose,
  isPending = false,
}: ScheduleEditModalProps) {
  const [editMode, setEditMode] = useState<EditMode>(isRecurring ? "choose" : "edit");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    startTime: schedule.startTime || "09:00",
    endTime: schedule.endTime || "18:00",
    breaks: (schedule.breaks as { startTime: string; endTime: string }[] | null) || [],
    slotDuration: schedule.slotDuration || 60,
    serviceId: schedule.serviceId || null,
    daysOfWeek: (schedule.daysOfWeek as number[] | null) || [],
    specificDate: schedule.specificDate
      ? format(new Date(schedule.specificDate), "yyyy-MM-dd")
      : format(clickedDate, "yyyy-MM-dd"),
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const serviceName = formData.serviceId
    ? services.find((s) => s.id === formData.serviceId)?.name || "Service"
    : "All Services";

  const handleChooseMode = (mode: "this_occurrence" | "all_occurrences") => {
    setEditMode(mode);
  };

  const handleAddBreak = () => {
    setFormData((prev) => ({
      ...prev,
      breaks: [...prev.breaks, { startTime: "13:00", endTime: "14:00" }],
    }));
  };

  const handleRemoveBreak = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      breaks: prev.breaks.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateBreak = (index: number, field: "startTime" | "endTime", value: string) => {
    setFormData((prev) => ({
      ...prev,
      breaks: prev.breaks.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    }));
  };

  const handleDayToggle = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const handleSave = () => {
    if (isRecurring && editMode === "this_occurrence") {
      onSave({
        mode: "this_occurrence",
        scheduleId: schedule.id,
        updates: {
          scheduleType: "specific",
          specificDate: formData.specificDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          breaks: formData.breaks,
          slotDuration: formData.slotDuration,
          serviceId: formData.serviceId,
        },
        newSpecificDate: formData.specificDate,
      });
    } else if (isRecurring && editMode === "all_occurrences") {
      onSave({
        mode: "all_occurrences",
        scheduleId: schedule.id,
        updates: {
          startTime: formData.startTime,
          endTime: formData.endTime,
          breaks: formData.breaks,
          slotDuration: formData.slotDuration,
          serviceId: formData.serviceId,
          daysOfWeek: formData.daysOfWeek,
        },
      });
    } else {
      onSave({
        mode: "single",
        scheduleId: schedule.id,
        updates: {
          startTime: formData.startTime,
          endTime: formData.endTime,
          breaks: formData.breaks,
          slotDuration: formData.slotDuration,
          serviceId: formData.serviceId,
          specificDate: formData.specificDate,
        },
      });
    }
  };

  const handleDelete = () => {
    if (isRecurring && editMode === "this_occurrence") {
      onDelete({
        mode: "this_occurrence",
        scheduleId: schedule.id,
        specificDate: formData.specificDate,
      });
    } else if (isRecurring && editMode === "all_occurrences") {
      onDelete({
        mode: "all_occurrences",
        scheduleId: schedule.id,
      });
    } else {
      onDelete({
        mode: "single",
        scheduleId: schedule.id,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-semibold">Edit Schedule</h2>
            <p className="text-sm text-neutral-500">
              {format(clickedDate, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="w-8 h-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {editMode === "choose" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <Repeat className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  This is a recurring schedule ({dayNames.filter((_, i) => ((schedule.daysOfWeek as number[]) || []).includes(i)).join(", ")}). 
                  How would you like to edit it?
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3 px-4"
                onClick={() => handleChooseMode("this_occurrence")}
              >
                <Calendar className="w-5 h-5 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">This occurrence only</div>
                  <div className="text-xs text-neutral-500">
                    Edit only {format(clickedDate, "MMMM d")} — creates a one-time override
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3 px-4"
                onClick={() => handleChooseMode("all_occurrences")}
              >
                <Repeat className="w-5 h-5 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium">All occurrences</div>
                  <div className="text-xs text-neutral-500">
                    Edit the recurring schedule for all days
                  </div>
                </div>
              </Button>

              <Separator />

              <Button
                variant="ghost"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete schedule...
              </Button>

              {showDeleteConfirm && (
                <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-800 font-medium">Delete which?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-red-600 border-red-300 hover:bg-red-100"
                      onClick={() =>
                        onDelete({
                          mode: "this_occurrence",
                          scheduleId: schedule.id,
                          specificDate: format(clickedDate, "yyyy-MM-dd"),
                        })
                      }
                      disabled={isPending}
                    >
                      This day only
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() =>
                        onDelete({ mode: "all_occurrences", scheduleId: schedule.id })
                      }
                      disabled={isPending}
                    >
                      All occurrences
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {(editMode === "this_occurrence" || editMode === "all_occurrences" || editMode === "edit") && (
            <div className="space-y-4">
              {editMode === "this_occurrence" && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-800">
                    Editing {format(clickedDate, "MMMM d")} only — this creates a new one-time schedule
                  </p>
                </div>
              )}

              {editMode === "all_occurrences" && (
                <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                  <Repeat className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <p className="text-xs text-purple-800">
                    Editing all occurrences of this recurring schedule
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Badge variant={formData.serviceId ? "secondary" : "default"}>
                  {serviceName}
                </Badge>
                <span className="text-xs text-neutral-500">
                  {isRecurring ? "Recurring" : "One-time"} schedule
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Start Time</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">End Time</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {editMode === "this_occurrence" && (
                <div>
                  <Label className="text-sm">Date</Label>
                  <Input
                    type="date"
                    value={formData.specificDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, specificDate: e.target.value }))}
                  />
                </div>
              )}

              {editMode === "all_occurrences" && (
                <div>
                  <Label className="text-sm mb-2 block">Active Days</Label>
                  <div className="flex gap-1 flex-wrap">
                    {dayNames.map((name, idx) => (
                      <Button
                        key={idx}
                        variant={formData.daysOfWeek.includes(idx) ? "default" : "outline"}
                        size="sm"
                        className="w-10 h-10 p-0"
                        onClick={() => handleDayToggle(idx)}
                      >
                        {name.charAt(0)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm">Slot Duration</Label>
                <Select
                  value={String(formData.slotDuration)}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, slotDuration: parseInt(val) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Applies To</Label>
                <Select
                  value={formData.serviceId ? String(formData.serviceId) : "all"}
                  onValueChange={(val) =>
                    setFormData((prev) => ({
                      ...prev,
                      serviceId: val === "all" ? null : parseInt(val),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={String(service.id)}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Break Times</Label>
                  <Button variant="ghost" size="sm" onClick={handleAddBreak} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Break
                  </Button>
                </div>
                {formData.breaks.length === 0 ? (
                  <p className="text-xs text-neutral-400">No breaks configured</p>
                ) : (
                  <div className="space-y-2">
                    {formData.breaks.map((brk, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={brk.startTime}
                          onChange={(e) => handleUpdateBreak(idx, "startTime", e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-xs text-neutral-400">to</span>
                        <Input
                          type="time"
                          value={brk.endTime}
                          onChange={(e) => handleUpdateBreak(idx, "endTime", e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBreak(idx)}
                          className="w-8 h-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={onClose} disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </div>

              {showDeleteConfirm && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-800 font-medium">
                      {isRecurring && editMode === "all_occurrences"
                        ? "Delete this entire recurring schedule?"
                        : "Delete this schedule?"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDelete}
                      disabled={isPending}
                    >
                      {isPending ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
