import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import { SunIcon, MoonIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";

export default function TopNavBar({ isExpanded = true }) {
  const { dark, setDark } = useTheme();

  return (
    <div 
      className={`fixed top-0 right-0 z-50 transition-all duration-300 ease-in-out bg-transparent backdrop-blur-md left-0 md:left-[104px] ${isExpanded ? 'lg:left-[280px]' : 'lg:left-[104px]'}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center px-4 md:px-8 lg:px-12 py-3 md:py-4">
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2 w-full max-w-sm transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0 focus-within:shadow-inner">
            <MagnifyingGlassIcon size={20} weight="bold" />
            <input
            type="text"
            value=""
            onChange={() => {}}
            placeholder="Search Google or type a URL"
            className="bg-transparent border-none outline-none text-text-primary placeholder-text-muted w-full"
          />
          </div>
        </div>

        
      </div>
    </div>
  );
}
