"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filterValue?: string;
  onFilterChange?: (v: string) => void;
  filterOptions?: FilterOption[];
  filterPlaceholder?: string;
  searchPlaceholder?: string;
}

export default function FilterBar({
  search,
  onSearchChange,
  filterValue,
  onFilterChange,
  filterOptions,
  filterPlaceholder = "All",
  searchPlaceholder = "Search…",
}: FilterBarProps) {
  return (
    <div className="flex gap-3 mb-6">
      <Input
        className="flex-1"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {filterOptions && onFilterChange && (
        <Select value={filterValue} onValueChange={onFilterChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={filterPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filterPlaceholder}</SelectItem>
            {filterOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
