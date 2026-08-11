'use client';

import { FiLayers } from 'react-icons/fi';

const THEMES = [
    { id: 'mono', label: 'B&W Mono', chip: 'bg-zinc-200 border-zinc-400', activeCls: 'bg-zinc-800 text-white border-zinc-500 shadow-md font-bold' },
    { id: 'purple', label: 'Purple', chip: 'bg-purple-500', activeCls: 'bg-purple-600/40 text-purple-200 border-purple-500/60 shadow-md font-bold' },
    { id: 'emerald', label: 'Emerald', chip: 'bg-emerald-500', activeCls: 'bg-emerald-600/40 text-emerald-200 border-emerald-500/60 shadow-md font-bold' },
    { id: 'blue', label: 'Blue', chip: 'bg-blue-500', activeCls: 'bg-blue-600/40 text-blue-200 border-blue-500/60 shadow-md font-bold' },
    { id: 'amber', label: 'Amber', chip: 'bg-amber-500', activeCls: 'bg-amber-600/40 text-amber-200 border-amber-500/60 shadow-md font-bold' },
];

export default function ColorModeToggle({ colorMode = 'mono', onChange }) {
    const activeTheme = colorMode === 'multi' ? 'purple' : colorMode;

    return (
        <div className="inline-flex items-center bg-black/80 border border-white/15 p-1 rounded-md shrink-0 gap-1 backdrop-blur-md">
            {THEMES.map(theme => {
                const isActive = activeTheme === theme.id;
                return (
                    <button
                        key={theme.id}
                        type="button"
                        onClick={() => onChange(theme.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${isActive
                                ? theme.activeCls
                                : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/5 font-medium'
                            }`}
                        title={`${theme.label} Theme Mode`}
                    >
                        {theme.id === 'mono' ? (
                            <FiLayers size={13} className={isActive ? 'text-white' : 'text-white/40'} />
                        ) : (
                            <span className={`w-2.5 h-2.5 rounded-full ${theme.chip} inline-block border border-black/40`} />
                        )}
                        <span className="text-[11px]">{theme.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
