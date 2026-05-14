import React from "react";
import { HOSPITAL_MODULES, StatusBadge } from "./ModuleConfig";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface HospitalSidebarProps {
  activeModule: string;
  onModuleChange: (id: string) => void;
}

export function HospitalSidebar({ activeModule, onModuleChange }: HospitalSidebarProps) {
  return (
    <div className="w-full lg:w-64 flex flex-col gap-1">
      <div className="px-3 py-2">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 px-3">
          Operational Modules
        </h2>
        <div className="space-y-1">
          {HOSPITAL_MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => onModuleChange(module.id)}
              className={cn(
                "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl transition-all group text-left",
                activeModule === module.id
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  activeModule === module.id
                    ? "bg-white/10 text-white"
                    : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-900"
                )}>
                  {module.icon}
                </div>
                <span className="text-xs font-bold truncate">{module.title}</span>
              </div>
              <StatusBadge status={module.status} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-slate-100">
        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
          <h3 className="text-[10px] font-bold uppercase text-primary mb-1">Scale your Clinic</h3>
          <p className="text-[10px] text-slate-600 leading-relaxed font-medium mb-3">
            Add more departments or request custom integrations.
          </p>
          <Button variant="outline" className="w-full h-7 text-[9px] font-bold uppercase tracking-wider bg-white border-primary/20 text-primary hover:bg-primary/5">
            View Enterprise Plans
          </Button>
        </div>
      </div>
    </div>
  );
}
