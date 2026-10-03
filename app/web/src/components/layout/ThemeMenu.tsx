import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeChoice } from '@/lib/theme';
import { Menu, MenuItem } from '../ui/overlay';

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor className="size-4" /> },
  { value: 'light', label: 'Light', icon: <Sun className="size-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="size-4" /> },
];

export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0];
  return (
    <Menu
      trigger={
        <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Theme: ${current.label}`}>
          {current.icon}
        </button>
      }
    >
      {OPTIONS.map((o) => (
        <MenuItem key={o.value} icon={o.icon} onSelect={() => setTheme(o.value)}>
          {o.label}
          {o.value === theme && <span className="ml-auto text-xs text-ink-3">✓</span>}
        </MenuItem>
      ))}
    </Menu>
  );
}
