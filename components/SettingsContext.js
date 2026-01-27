'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({ currency: '$' });
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            setSettings(prev => ({ ...prev, ...data }));
        } catch (error) {
            console.error('Failed to load settings', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (key, value) => {
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            setSettings(prev => ({ ...prev, [key]: value }));
            return true;
        } catch (error) {
            console.error('Failed to update setting', error);
            return false;
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    // Apply theme to body
    useEffect(() => {
        if (settings.system_theme) {
            const theme = settings.system_theme;
            // Remove all known theme classes
            document.body.classList.remove('theme-light', 'theme-blue', 'theme-midnight');
            // Add new theme class if not default
            if (theme !== 'default') {
                document.body.classList.add(`theme-${theme}`);
            }
        }
    }, [settings.system_theme]);

    return (
        <SettingsContext.Provider value={{ settings, updateSetting, loading }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    return useContext(SettingsContext);
}
