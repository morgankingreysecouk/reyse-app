type ClassValue = string | number | null | boolean | undefined;

// Small, dependency-free class-joiner — avoids pulling in clsx/tailwind-merge
// for what is currently just "join truthy strings, skip the rest".
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
