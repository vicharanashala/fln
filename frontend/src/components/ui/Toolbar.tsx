import { Download, Filter, Plus, FileText, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import Button from "./Button";

interface Props {
  onExport?: (type: "csv" | "excel" | "pdf") => void;
  onAdd?: () => void;
  addLabel?: string;
  onRefresh?: () => void;
  showAdd?: boolean;
}

export default function Toolbar({ onExport, onAdd, addLabel = "Add New", onRefresh, showAdd = true }: Props) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button className="btn-secondary h-9 text-xs">
        <Filter className="w-3.5 h-3.5" /> Filters
      </button>
      {onRefresh && (
        <button onClick={onRefresh} className="btn-ghost h-9 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="flex-1" />
      {onExport && (
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => onExport("csv")} className="px-3 h-9 text-xs flex items-center gap-1.5 text-slate-700 hover:bg-slate-50 border-r border-slate-200">
            <FileText className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => onExport("excel")} className="px-3 h-9 text-xs flex items-center gap-1.5 text-slate-700 hover:bg-slate-50 border-r border-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button onClick={() => onExport("pdf")} className="px-3 h-9 text-xs flex items-center gap-1.5 text-slate-700 hover:bg-slate-50">
            <Printer className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      )}
      {showAdd && onAdd && (
        <Button onClick={onAdd} size="md">
          <Plus className="w-4 h-4" /> {addLabel}
        </Button>
      )}
    </div>
  );
}