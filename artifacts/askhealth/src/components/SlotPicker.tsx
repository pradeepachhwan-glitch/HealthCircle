import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { Clock, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SlotPickerProps {
  doctorId: number;
  onSlotSelect: (slot: Date) => void;
  selectedSlot?: Date | null;
}

export function SlotPicker({ doctorId, onSlotSelect, selectedSlot }: SlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  const { data: slots = [], isLoading } = useQuery<string[]>({
    queryKey: ["/api/scheduler/slots", doctorId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: () => fetch(`/api/scheduler/slots?doctorId=${doctorId}&date=${format(selectedDate, "yyyy-MM-dd")}`).then(res => res.json()),
  });

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Calendar className="w-3 h-3" /> Select Date
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {dates.map((date) => (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={cn(
                "flex flex-col items-center min-w-[64px] p-3 rounded-2xl border transition-all",
                isSameDay(date, selectedDate)
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white text-slate-600 border-slate-100 hover:border-primary/30"
              )}
            >
              <span className="text-[10px] font-bold uppercase opacity-60">{format(date, "EEE")}</span>
              <span className="text-sm font-black mt-1">{format(date, "d")}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Slots Grid */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-3 h-3" /> Available Slots
        </label>
        
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-200" /></div>
        ) : slots.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
             <p className="text-xs font-medium text-slate-400 italic">No slots available for this date.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((timeStr) => {
              const [hours, minutes] = timeStr.split(":").map(Number);
              const slotDate = new Date(selectedDate);
              slotDate.setHours(hours, minutes, 0, 0);
              
              const isSelected = selectedSlot && isSameDay(slotDate, selectedSlot) && 
                               slotDate.getHours() === selectedSlot.getHours() && 
                               slotDate.getMinutes() === selectedSlot.getMinutes();

              return (
                <button
                  key={timeStr}
                  onClick={() => onSlotSelect(slotDate)}
                  className={cn(
                    "py-2.5 rounded-xl border text-xs font-bold transition-all",
                    isSelected
                      ? "bg-primary/10 text-primary border-primary shadow-sm ring-1 ring-primary"
                      : "bg-white text-slate-600 border-slate-100 hover:border-primary/20"
                  )}
                >
                  {timeStr}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
