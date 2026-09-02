"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export interface AutocompleteItem {
  label: string
  value: string
}

interface AutocompleteInputProps {
  items: AutocompleteItem[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** If true, selecting an item clears the input for multi-select pattern */
  clearOnSelect?: boolean
  /** Callback when an item is selected (for multi-select) */
  onSelect?: (item: AutocompleteItem) => void
  /** If true, hides the selected items from the list */
  filterSelected?: (item: AutocompleteItem) => boolean
  /** Right-side action button */
  actionButton?: React.ReactNode
}

export function AutocompleteInput({
  items,
  value,
  onValueChange,
  placeholder = "Inizia a digitare...",
  emptyMessage = "Nessun risultato trovato.",
  disabled = false,
  className,
  clearOnSelect = false,
  onSelect,
  filterSelected,
  actionButton,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value ?? "")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = items.filter((item) => {
    const matchesSearch = item.label
      .toLowerCase()
      .includes(search.toLowerCase())
    if (filterSelected) {
      return matchesSearch && filterSelected(item)
    }
    return matchesSearch
  })

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setSearch(val)
      setOpen(true)
      setHighlightedIndex(-1)
      if (onValueChange && !clearOnSelect) {
        onValueChange(val)
      }
    },
    [onValueChange, clearOnSelect]
  )

  const handleSelect = useCallback(
    (item: AutocompleteItem) => {
      if (clearOnSelect) {
        setSearch("")
        onValueChange?.("")
      } else {
        setSearch(item.label)
        onValueChange?.(item.value)
      }
      onSelect?.(item)
      setOpen(false)
      setHighlightedIndex(-1)
      inputRef.current?.blur()
    },
    [clearOnSelect, onValueChange, onSelect]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1
        )
      } else if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault()
        handleSelect(filtered[highlightedIndex])
      } else if (e.key === "Escape") {
        setOpen(false)
        setHighlightedIndex(-1)
      }
    },
    [filtered, highlightedIndex, handleSelect]
  )

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLDivElement>(
        "[data-autocomplete-item]"
      )
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setHighlightedIndex(-1)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  // Sync search when value changes externally
  useEffect(() => {
    if (!clearOnSelect && value !== undefined) {
      const matched = items.find((i) => i.value === value)
      if (matched) {
        setSearch(matched.label)
      }
    }
  }, [value, items, clearOnSelect])

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-2">
        <div ref={containerRef} className="relative flex-1">
          <Input
            value={search}
            onChange={handleInputChange}
            onFocus={() => {
              if (search.length > 0 || filtered.length > 0) {
                setOpen(true)
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="autocomplete-list"
            autoComplete="off"
            ref={inputRef}
          />
          {open && (
            <div
              ref={listRef}
              id="autocomplete-list"
              role="listbox"
              className={cn(
                "absolute left-0 right-0 top-full z-50 mt-1.5",
                "max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1.5",
                "text-sm text-popover-foreground shadow-lg backdrop-blur-sm",
                "animate-in fade-in-0 zoom-in-95"
              )}
            >
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                filtered.map((item, index) => (
                  <div
                    key={item.value}
                    data-autocomplete-item
                    role="option"
                    aria-selected={index === highlightedIndex}
                    className={cn(
                      "relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm outline-none select-none transition-colors",
                      index === highlightedIndex
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-accent/50 text-foreground"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelect(item)
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span className="flex-1 truncate">{item.label}</span>
                    {!clearOnSelect && value === item.value && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        {actionButton}
      </div>
    </div>
  )
}