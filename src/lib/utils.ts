import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return crypto.randomUUID();
}

export function truncateText(val: any, maxLength: number = 10): string {
  if (!val) return '';
  let str = '';
  if (Array.isArray(val)) {
    if (val.length > 0 && typeof val[0] === 'object' && val[0].title) {
       str = val.map(v => v.title).join('');
    } else {
       str = val.join('');
    }
  } else {
    str = String(val);
  }
  str = str.replace(/\n/g, '');
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}
