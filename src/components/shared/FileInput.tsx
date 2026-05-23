import { useRef } from "react";
import { Info, X } from "lucide-react";
import { Label } from "@/components/ui/label";

interface FileInputProps {
  label: string;
  multiple?: boolean;
  accept?: string;
  files: File[];
  existingUrls?: string[];
  onChange: (files: File[]) => void;
  tooltip?: string;
}

export function FileInput({
  label,
  multiple,
  accept,
  files,
  existingUrls,
  onChange,
  tooltip,
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    onChange(multiple ? [...files, ...selected] : selected);
    e.target.value = "";
  }

  function removeFile(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {tooltip && (
          <div className="group relative">
            <Info size={13} className="text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 z-50 text-center leading-snug">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-400 transition-colors text-center"
      >
        <p className="text-sm text-gray-500">
          Click to {multiple ? "add files" : "upload"}{" "}
          <span className="text-black font-medium">Browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {(existingUrls?.length ?? 0) > 0 && files.length === 0 && (
        <div className="space-y-1">
          {existingUrls!.map((url, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="truncate">{url.split("/").pop()}</span>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 shrink-0">
                view
              </a>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-2 text-gray-400 hover:text-red-500 shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
