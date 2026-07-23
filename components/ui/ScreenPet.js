'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiPrinter, FiX, FiSearch, FiLock, FiHeart, FiDownload, FiLoader } from 'react-icons/fi';

const AVAILABLE_THEMES = [
    {
        name: 'green',
        r: 0, g: 230, b: 118,
        primary: 'rgb(0, 230, 118)',
        shadow: 'rgba(0, 230, 118, 0.667)',
        text: '#00e676',
        border: 'border-emerald-500/30 hover:border-emerald-400 text-emerald-400',
        pingShadow: 'shadow-[0_0_6px_#10b981]',
        pingBg: 'bg-emerald-400'
    },
    {
        name: 'blue',
        r: 41, g: 121, b: 255,
        primary: 'rgb(41, 121, 255)',
        shadow: 'rgba(41, 121, 255, 0.667)',
        text: '#2979ff',
        border: 'border-blue-500/30 hover:border-blue-400 text-blue-400',
        pingShadow: 'shadow-[0_0_6px_#3b82f6]',
        pingBg: 'bg-blue-400'
    },
    {
        name: 'purple',
        r: 224, g: 64, b: 251,
        primary: 'rgb(224, 64, 251)',
        shadow: 'rgba(224, 64, 251, 0.667)',
        text: '#e040fb',
        border: 'border-fuchsia-500/30 hover:border-fuchsia-400 text-fuchsia-400',
        pingShadow: 'shadow-[0_0_6px_#d946ef]',
        pingBg: 'bg-fuchsia-400'
    },
    {
        name: 'pink',
        r: 255, g: 64, b: 129,
        primary: 'rgb(255, 64, 129)',
        shadow: 'rgba(255, 64, 129, 0.667)',
        text: '#ff4081',
        border: 'border-pink-500/30 hover:border-pink-400 text-pink-400',
        pingShadow: 'shadow-[0_0_6px_#ec4899]',
        pingBg: 'bg-pink-400'
    },
    {
        name: 'orange',
        r: 255, g: 109, b: 0,
        primary: 'rgb(255, 109, 0)',
        shadow: 'rgba(255, 109, 0, 0.667)',
        text: '#ff6d00',
        border: 'border-orange-500/30 hover:border-orange-400 text-orange-400',
        pingShadow: 'shadow-[0_0_6px_#f97316]',
        pingBg: 'bg-orange-400'
    }
];

export default function ScreenPet() {
    const [state, setState] = useState('idle'); // idle, sleep, walking, copied, downloading, password, searching, dragged
    const [emotion, setEmotion] = useState('normal'); // normal, happy, wink, thinking, gasp
    const [hidden, setHidden] = useState(true); // Hidden until mounted and read from localStorage
    const [zzzList, setZzzList] = useState([]); // List of floating Zzzs
    const [showSpeechBubble, setShowSpeechBubble] = useState(false);
    const [speechText, setSpeechText] = useState('');
    const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 }); // Pupils track cursor
    const [userName, setUserName] = useState('');
    const [themeColor, setThemeColor] = useState(AVAILABLE_THEMES[0]);
    const [loadElapsed, setLoadElapsed] = useState(0);
    const loadTimeInterval = useRef(null);
    const themeColorRef = useRef(themeColor);

    useEffect(() => {
        themeColorRef.current = themeColor;
    }, [themeColor]);

    const petRef = useRef(null);
    const zzzCounter = useRef(0);
    const activityTimer = useRef(null);
    const walkTimer = useRef(null);
    const speechTimer = useRef(null);
    const emotionTimer = useRef(null);

    // Position tracking (percentage values for viewport responsiveness)
    const position = useRef({ x: 85, y: 75 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const dragOffset = useRef({ x: 0, y: 0 });

    // Fetch current logged in user to customize interactive dialogue
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                const isPetHidden = localStorage.getItem('erp_pet_hidden') === 'true';
                if (data && data.name) {
                    const first = data.name.split(' ')[0];
                    setUserName(first);
                    if (!isPetHidden) {
                        triggerSpeech(`Hello ${first}! I'm your ERP assistant. Drag me anywhere!`, 5000);
                    }
                } else {
                    if (!isPetHidden) {
                        triggerSpeech("Hello! I'm your ERP assistant. Drag me anywhere!", 5000);
                    }
                }
            })
            .catch(() => {
                const isPetHidden = localStorage.getItem('erp_pet_hidden') === 'true';
                if (!isPetHidden) {
                    triggerSpeech("Hello! I'm your ERP assistant. Drag me anywhere!", 5000);
                }
            });
    }, []);

    // Intercept global fetch to show processing state on background processes
    useEffect(() => {
        if (hidden) return;

        const originalFetch = window.fetch;
        let activeRequests = 0;
        let clearTimer = null;

        window.fetch = async function (...args) {
            const url = args[0] || '';
            const isIgnored = typeof url === 'string' && (
                url.includes('/api/auth/me') ||
                url.includes('/_next/data')
            );

            if (!isIgnored) {
                activeRequests++;
                setState('loading');
                if (clearTimer) clearTimeout(clearTimer);

                if (!loadTimeInterval.current) {
                    let spokenSlowPhrase = false;
                    setLoadElapsed(0);
                    loadTimeInterval.current = setInterval(() => {
                        setLoadElapsed(prev => {
                            const next = prev + 0.1;
                            if (next >= 2.0 && !spokenSlowPhrase) {
                                spokenSlowPhrase = true;
                                const slowPhrases = [
                                    userName ? `This is taking a bit long, ${userName}...` : "This is taking a bit long...",
                                    "Still processing heavy calculations...",
                                    userName ? `Hang tight, ${userName}, almost there...` : "Hang tight, almost there...",
                                    "Working hard on this request..."
                                ];
                                triggerSpeech(slowPhrases[Math.floor(Math.random() * slowPhrases.length)], 3000);
                            }
                            if (next >= 4.0) {
                                clearInterval(loadTimeInterval.current);
                            }
                            return next;
                        });
                    }, 100);
                }

                const loadPhrases = [
                    userName ? `Processing data, ${userName}...` : "Processing data...",
                    userName ? `Loading updates, ${userName}...` : "Loading updates...",
                    "Recalculating statistics...",
                    "Updating ERP dashboard...",
                    "Syncing records..."
                ];
                triggerSpeech(loadPhrases[Math.floor(Math.random() * loadPhrases.length)], 2000);
            }

            try {
                return await originalFetch.apply(this, args);
            } finally {
                if (!isIgnored) {
                    activeRequests--;
                    if (activeRequests <= 0) {
                        activeRequests = 0;
                        if (loadTimeInterval.current) {
                            clearInterval(loadTimeInterval.current);
                            loadTimeInterval.current = null;
                        }
                        setLoadElapsed(0);
                        clearTimer = setTimeout(() => {
                            setState(prev => prev === 'loading' ? 'idle' : prev);
                        }, 800);
                    }
                }
            }
        };

        return () => {
            window.fetch = originalFetch;
            if (clearTimer) clearTimeout(clearTimer);
            if (loadTimeInterval.current) {
                clearInterval(loadTimeInterval.current);
                loadTimeInterval.current = null;
            }
        };
    }, [hidden, userName]);

    // Random color theme switcher
    useEffect(() => {
        if (hidden) return;

        const interval = setInterval(() => {
            // 35% chance to change theme color
            if (Math.random() < 0.35) {
                const currentThemeName = themeColorRef.current?.name || 'green';
                const options = AVAILABLE_THEMES.filter(t => t.name !== currentThemeName);
                const nextTheme = options[Math.floor(Math.random() * options.length)];
                
                setThemeColor(nextTheme);
                
                const colorPhrases = {
                    green: [
                        "Back to standard green calibration!",
                        "Systems normal. Green looks good on me.",
                        "Default energy levels restored!"
                    ],
                    blue: [
                        "Entering deep analytical blue mode.",
                        "Let's focus with some calm blue vibes.",
                        "Blue light feels very soothing!"
                    ],
                    purple: [
                        "Ooh, mysterious purple activated!",
                        "I'm feeling extra stylish in purple today.",
                        "Purple power mode!"
                    ],
                    pink: [
                        "Fabulous pink mode on!",
                        "I think pink is definitely my color.",
                        "Feeling cheerful in pink!"
                    ],
                    orange: [
                        "High performance orange initialized!",
                        "Let's speed up with bright orange energy!",
                        "Orange you glad I'm here to help?"
                    ]
                };
                
                const phrases = colorPhrases[nextTheme.name] || ["Changed my color theme!"];
                triggerSpeech(phrases[Math.floor(Math.random() * phrases.length)], 4000);
                
                // If it is not default green, set a timer to return back to green after 12-15 seconds
                if (nextTheme.name !== 'green') {
                    setTimeout(() => {
                        const greenTheme = AVAILABLE_THEMES.find(t => t.name === 'green');
                        setThemeColor(greenTheme);
                        const backPhrases = colorPhrases.green;
                        triggerSpeech(backPhrases[Math.floor(Math.random() * backPhrases.length)], 3000);
                    }, 12000);
                }
            }
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [hidden, userName]);

    // Observer to detect when modals or dialogs open
    useEffect(() => {
        if (hidden) return;

        const checkAndSetDialogState = () => {
            const dialogElements = document.querySelectorAll(
                'dialog, [role="dialog"], [role="alertdialog"], [class*="modal-open"], [class*="Modal"], [class*="modal"]'
            );

            let isVisible = false;
            for (const el of dialogElements) {
                if (el.contains(petRef.current)) continue;

                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);

                if (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    rect.width > 0 &&
                    rect.height > 0
                ) {
                    const zIndex = parseInt(style.zIndex, 10);
                    if (zIndex > 30 || el.tagName === 'DIALOG' || el.getAttribute('role') === 'dialog') {
                        isVisible = true;
                        break;
                    }
                }
            }

            if (isVisible) {
                setState(prev => {
                    if (prev !== 'question' && prev !== 'sleep' && prev !== 'dragged') {
                        const phrases = [
                            userName ? `What are we choosing here, ${userName}?` : "What are we choosing here?",
                            "Let's look at this option!",
                            userName ? `Need help with this decision, ${userName}?` : "Need help with this decision?",
                            "Interesting prompt!"
                        ];
                        triggerSpeech(phrases[Math.floor(Math.random() * phrases.length)], 3000);
                        return 'question';
                    }
                    return prev;
                });
            } else {
                setState(prev => prev === 'question' ? 'idle' : prev);
            }
        };

        checkAndSetDialogState();

        const observer = new MutationObserver(() => {
            checkAndSetDialogState();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'open']
        });

        return () => {
            observer.disconnect();
        };
    }, [hidden, userName]);

    // Initialize pet position and visibility
    useEffect(() => {
        const isPetHidden = localStorage.getItem('erp_pet_hidden') === 'true';
        setHidden(isPetHidden);

        const savedX = localStorage.getItem('erp_pet_x');
        const savedY = localStorage.getItem('erp_pet_y');
        if (savedX && savedY) {
            position.current = { x: parseFloat(savedX), y: parseFloat(savedY) };
        } else {
            // Default bottom right area
            position.current = { x: 85, y: 80 };
        }
        updateElementPosition();
    }, []);

    // Set up global event listeners for state management and cursor tracking
    useEffect(() => {
        if (hidden) return;

        // 1. User activity monitoring (sleep mode)
        const resetActivity = () => {
            if (state === 'sleep') {
                setState('idle');
                triggerSpeech(userName ? `Yawn... I'm awake, ${userName}!` : "Yawn... I'm awake!", 3000);
            }
            clearTimeout(activityTimer.current);
            activityTimer.current = setTimeout(() => {
                setState('sleep');
            }, 25000); // Sleep after 25s of inactivity
        };

        const handleMouseMove = (e) => {
            if (isDragging.current) return;
            resetActivity();

            // Pupil tracking cursor when awake
            if (petRef.current && state !== 'sleep') {
                const rect = petRef.current.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dx = e.clientX - centerX;
                const dy = e.clientY - centerY;
                const distance = Math.hypot(dx, dy);
                const maxOffset = 3.5; // Max pupil offset in pixels

                if (distance > 0) {
                    const angle = Math.atan2(dy, dx);
                    const offsetAmount = Math.min(maxOffset, distance / 45);
                    setEyeOffset({
                        x: Math.cos(angle) * offsetAmount,
                        y: Math.sin(angle) * offsetAmount
                    });
                }
            }
        };

        const handleInteraction = () => {
            if (isDragging.current) return;
            resetActivity();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('keydown', handleInteraction);
        window.addEventListener('scroll', handleInteraction, true);
        window.addEventListener('click', handleInteraction);

        resetActivity();

        // 2. Form Input tracking (Focusing search or password fields)
        const handleFocusIn = (e) => {
            const target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                if (target.type === 'password') {
                    setState('password');
                    triggerSpeech(userName ? `Securing your credentials, ${userName}!` : "Securing your credentials!", 4000);
                } else if (target.placeholder?.toLowerCase().includes('search') ||
                    target.name?.toLowerCase().includes('search') ||
                    target.id?.toLowerCase().includes('search') ||
                    target.className?.toLowerCase().includes('search')) {
                    setState('searching');
                    triggerSpeech(userName ? `Looking for something, ${userName}?` : "Looking for something?", 4000);
                }
            }
        };

        const handleFocusOut = () => {
            setState('idle');
        };

        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);

        // 3. Copy tracking (copied state)
        const handleCopy = () => {
            setState('copied');
            triggerSpeech(userName ? `Copied to clipboard, ${userName}!` : "Copied to clipboard!", 3000);
            setTimeout(() => {
                setState('idle');
            }, 3000);
        };
        document.addEventListener('copy', handleCopy);

        // 4. Download tracking
        const handleDownloadClick = (e) => {
            const target = e.target.closest('a, button');
            if (target) {
                const hasDownloadAttr = target.hasAttribute('download');
                const href = target.getAttribute('href') || '';
                const isPdfOrSheet = href.includes('/pdf') || href.includes('/download') || href.endsWith('.pdf') || href.endsWith('.csv') || href.endsWith('.xlsx');

                if (hasDownloadAttr || isPdfOrSheet || target.textContent?.toLowerCase().includes('pdf') || target.textContent?.toLowerCase().includes('download')) {
                    setState('downloading');
                    triggerSpeech(userName ? `Exporting your files, ${userName}...` : "Exporting your files...", 4000);
                    setTimeout(() => {
                        setState('idle');
                    }, 4000);
                }
            }
        };
        document.addEventListener('click', handleDownloadClick, true);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleInteraction);
            window.removeEventListener('scroll', handleInteraction, true);
            window.removeEventListener('click', handleInteraction);
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('click', handleDownloadClick, true);
            clearTimeout(activityTimer.current);
        };
    }, [hidden, state]);

    // Set up random emotion cycles when idle
    useEffect(() => {
        if (hidden || state !== 'idle') {
            setEmotion('normal');
            clearInterval(emotionTimer.current);
            return;
        }

        const cycleEmotion = () => {
            const emotions = ['normal', 'happy', 'wink', 'thinking', 'gasp'];
            const nextEmotion = emotions[Math.floor(Math.random() * emotions.length)];
            setEmotion(nextEmotion);

            // Revert back to normal after 3 seconds
            setTimeout(() => {
                setEmotion('normal');
            }, 3000);
        };

        emotionTimer.current = setInterval(cycleEmotion, 8000 + Math.random() * 5000);
        return () => clearInterval(emotionTimer.current);
    }, [hidden, state]);

    // Set up autonomous walking behavior
    useEffect(() => {
        if (hidden || state === 'sleep' || state === 'password' || state === 'searching' || state === 'copied' || state === 'downloading' || state === 'dragged') {
            clearInterval(walkTimer.current);
            return;
        }

        const triggerRandomWalk = () => {
            if (isDragging.current || state === 'sleep') return;

            // Generate new random viewport percentages (avoiding extreme edges)
            const targetX = 5 + Math.random() * 80; // 5% to 85%
            const targetY = 10 + Math.random() * 70; // 10% to 80%

            // Apply transition classes for smooth movement of absolute values
            if (petRef.current) {
                petRef.current.style.transition = 'left 3.5s cubic-bezier(0.25, 1, 0.5, 1), top 3.5s cubic-bezier(0.25, 1, 0.5, 1)';
            }

            setState('walking');
            position.current = { x: targetX, y: targetY };
            updateElementPosition();

            // Save new position
            localStorage.setItem('erp_pet_x', targetX.toFixed(2));
            localStorage.setItem('erp_pet_y', targetY.toFixed(2));

            // Randomly say something while walking (30% chance)
            if (Math.random() < 0.3) {
                const phrases = [
                    userName ? `Just patrolling the dashboard, ${userName}...` : "Just patrolling the dashboard...",
                    "Checking the metrics!",
                    userName ? `Everything looks optimized, ${userName}!` : "ERP operations are running smoothly!",
                    userName ? `Need some help, ${userName}? Ask me!` : "Need some help? Ask me!",
                    "Pressmatics is looking beautiful today!",
                    userName ? `Keep up the great work, ${userName}!` : "Let's make today productive!"
                ];
                triggerSpeech(phrases[Math.floor(Math.random() * phrases.length)], 4000);
            }

            // Return to idle after walk animation ends
            setTimeout(() => {
                setState(prev => prev === 'walking' ? 'idle' : prev);
                if (petRef.current) {
                    petRef.current.style.transition = 'none';
                }
            }, 3500);
        };

        // Run walk logic every 25 to 40 seconds
        const interval = 25000 + Math.random() * 15000;
        walkTimer.current = setInterval(triggerRandomWalk, interval);

        return () => clearInterval(walkTimer.current);
    }, [hidden, state]);

    // Floating Zzzs particle generator during sleep state
    useEffect(() => {
        if (state !== 'sleep' || hidden) {
            setZzzList([]);
            return;
        }

        const spawnZzz = () => {
            const id = zzzCounter.current++;
            const newZzz = {
                id,
                style: {
                    left: '50px',
                    top: '-15px',
                    fontSize: `${10 + Math.random() * 8}px`,
                    animation: 'pet-float-zzz 2.5s ease-out forwards',
                }
            };
            setZzzList(prev => [...prev, newZzz].slice(-5)); // Cap at last 5 elements
        };

        const interval = setInterval(spawnZzz, 1200);
        return () => clearInterval(interval);
    }, [state, hidden]);

    // Position updates helper
    const updateElementPosition = () => {
        if (petRef.current) {
            petRef.current.style.left = `${position.current.x}vw`;
            petRef.current.style.top = `${position.current.y}vh`;
        }
    };

    // Speech bubble helper
    const triggerSpeech = (text, duration = 4000) => {
        clearTimeout(speechTimer.current);
        setSpeechText(text);
        setShowSpeechBubble(true);
        speechTimer.current = setTimeout(() => {
            setShowSpeechBubble(false);
        }, duration);
    };

    // Drag handlers
    const handleDragStart = (clientX, clientY) => {
        if (petRef.current) {
            isDragging.current = true;
            setState('dragged');
            triggerSpeech("Whoa! Where are we going?", 3000);

            // Cancel any transition timing
            petRef.current.style.transition = 'none';

            // Find current client position (in pixels)
            const rect = petRef.current.getBoundingClientRect();
            dragStart.current = { x: clientX, y: clientY };
            dragOffset.current = { x: rect.left, y: rect.top };
        }
    };

    const handleDragMove = (clientX, clientY) => {
        if (!isDragging.current || !petRef.current) return;

        const deltaX = clientX - dragStart.current.x;
        const deltaY = clientY - dragStart.current.y;

        let newLeftPx = dragOffset.current.x + deltaX;
        let newTopPx = dragOffset.current.y + deltaY;

        // Keep inside screen boundaries
        const petWidth = 96;
        const petHeight = 76;
        newLeftPx = Math.max(10, Math.min(window.innerWidth - petWidth - 10, newLeftPx));
        newTopPx = Math.max(10, Math.min(window.innerHeight - petHeight - 10, newTopPx));

        // Convert back to vw/vh percentage coordinates to retain viewport responsiveness
        const newXPercentage = (newLeftPx / window.innerWidth) * 100;
        const newYPercentage = (newTopPx / window.innerHeight) * 100;

        position.current = { x: newXPercentage, y: newYPercentage };
        updateElementPosition();
    };

    const handleDragEnd = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        setState('idle');
        triggerSpeech(userName ? `Safe landing, ${userName}!` : "Safe landing!", 3000);

        // Save position
        localStorage.setItem('erp_pet_x', position.current.x.toFixed(2));
        localStorage.setItem('erp_pet_y', position.current.y.toFixed(2));
    };

    // Mouse Drag Listeners
    const onMouseDown = (e) => {
        if (e.target.closest('.close-btn')) return;
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);

        const onMouseMove = (moveEvent) => {
            handleDragMove(moveEvent.clientX, moveEvent.clientY);
        };

        const onMouseUp = () => {
            handleDragEnd();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Touch Drag Listeners (Mobile support)
    const onTouchStart = (e) => {
        if (e.target.closest('.close-btn')) return;
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);

        const onTouchMove = (moveEvent) => {
            const touchMove = moveEvent.touches[0];
            handleDragMove(touchMove.clientX, touchMove.clientY);
        };

        const onTouchEnd = () => {
            handleDragEnd();
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };

        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
    };

    // Click/Tickle handler
    const handlePetClick = () => {
        if (isDragging.current || state === 'sleep') return;
        setEmotion('happy');
        const phrases = [
            "Haha! That tickles!",
            userName ? `Need anything done, ${userName}?` : "Need anything done?",
            "Let's print some orders!",
            userName ? `You're awesome, ${userName}!` : "Pressmatics is optimized!",
            userName ? `I love working with you, ${userName}!` : "Haha! Let's build!"
        ];
        triggerSpeech(phrases[Math.floor(Math.random() * phrases.length)], 3000);
        setTimeout(() => {
            setEmotion('normal');
        }, 3000);
    };

    // Close action
    const handleClose = () => {
        setHidden(true);
        localStorage.setItem('erp_pet_hidden', 'true');
    };

    // Restore action
    const handleRestore = () => {
        setHidden(false);
        localStorage.setItem('erp_pet_hidden', 'false');
        // Reset position to center bottom area so it is accessible
        position.current = { x: 85, y: 80 };
        setTimeout(() => {
            updateElementPosition();
            setState('idle');
            triggerSpeech(userName ? `I'm back! Let's get to work, ${userName}!` : "I'm back! Let's build some cool orders!", 5000);
        }, 100);
    };

    const getActiveColor = () => {
        if (state === 'loading') {
            const ratio = Math.min(1, loadElapsed / 4.0);
            const r = Math.round(themeColor.r + (255 - themeColor.r) * ratio);
            const g = Math.round(themeColor.g + (23 - themeColor.g) * ratio);
            const b = Math.round(themeColor.b + (68 - themeColor.b) * ratio);
            return `rgb(${r}, ${g}, ${b})`;
        }
        return themeColor.primary;
    };

    const getActiveShadow = () => {
        if (state === 'loading') {
            const ratio = Math.min(1, loadElapsed / 4.0);
            const r = Math.round(themeColor.r + (255 - themeColor.r) * ratio);
            const g = Math.round(themeColor.g + (23 - themeColor.g) * ratio);
            const b = Math.round(themeColor.b + (68 - themeColor.b) * ratio);
            return `rgba(${r}, ${g}, ${b}, 0.667)`;
        }
        return themeColor.shadow;
    };

    // Render eye visual states
    const renderEyes = () => {
        const isIconState = ['password', 'searching', 'copied', 'downloading', 'dragged', 'loading', 'question'].includes(state);

        return (
            <div className="relative flex items-center justify-center gap-3.5 z-20 will-change-transform">
                {/* Left Eye */}
                <div style={{ transform: 'rotate(8deg)' }} className="origin-center">
                    <div
                        style={{
                            animation: state === 'sleep' ? 'none' : 'pet-blink 4.5s infinite',
                            transform: state === 'sleep' ? 'scaleY(0.1)' : 'scaleY(1)'
                        }}
                        className="origin-center transition-transform duration-300"
                    >
                        <div
                            style={{
                                width: '17px',
                                height: '22px',
                                borderRadius: '10px',
                                backgroundColor: isIconState && state !== 'question' ? '#080808' : getActiveColor(),
                                border: isIconState && state !== 'question' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                boxShadow: isIconState && state !== 'question' ? 'none' : `${getActiveShadow()} 0px 0px 8px, ${getActiveShadow()} 0px 0px 16px`,
                                transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                            }}
                            className="transition-all duration-300 ease-out relative flex items-center justify-center overflow-hidden"
                        >
                            {/* Lock Icon */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'password' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <FiLock className="w-2.5 h-2.5" style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }} />
                            </div>
                            {/* Search Icon */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'searching' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <FiSearch className="w-2.5 h-2.5" style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }} />
                            </div>
                            {/* Heart Icon */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'copied' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <FiHeart className="w-2.5 h-2.5 fill-rose-500 text-rose-500 drop-shadow-[0_0_3px_#f43f5e]" />
                            </div>
                            {/* Download Icon */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'downloading' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <FiDownload className="w-2.5 h-2.5" style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }} />
                            </div>
                            {/* Struggle Left Eye (>) */}
                            <div 
                                className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'loading' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} text-[11px] font-extrabold font-mono select-none translate-y-[-0.5px]`}
                                style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }}
                            >
                                &gt;
                            </div>
                            {/* Dragged Cross */}
                            <div 
                                className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'dragged' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} text-[8px] font-extrabold font-mono`}
                                style={{ color: getActiveColor() }}
                            >
                                X
                            </div>
                            {/* Happy Curve ^ */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${emotion === 'happy' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} text-neutral-950 font-extrabold text-[10px] select-none translate-y-[-1px]`}>
                                ^
                            </div>
                            {/* Thinking Pupil inside capsule */}
                            <div className={`absolute w-1.5 h-1.5 rounded-full bg-neutral-950 transition-all duration-300 ${emotion === 'thinking' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} style={{ transform: 'translate(1px, -2px)' }}></div>
                        </div>
                    </div>
                </div>

                {/* Right Eye */}
                <div style={{ transform: 'rotate(-8deg)' }} className="origin-center">
                    <div
                        style={{
                            animation: state === 'sleep' ? 'none' : 'pet-blink 4.5s infinite',
                            transform: state === 'sleep' ? 'scaleY(0.1)' : 'scaleY(1)'
                        }}
                        className="origin-center transition-transform duration-300"
                    >
                        <div
                            style={{
                                width: '17px',
                                height: '22px',
                                borderRadius: '10px',
                                backgroundColor: isIconState || emotion === 'wink' ? '#080808' : getActiveColor(),
                                border: isIconState || emotion === 'wink' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                boxShadow: isIconState || emotion === 'wink' ? 'none' : `${getActiveShadow()} 0px 0px 8px, ${getActiveShadow()} 0px 0px 16px`,
                                transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                            }}
                            className="transition-all duration-300 ease-out relative flex items-center justify-center overflow-hidden"
                        >
                            {/* Lock Icon */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'password' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <FiLock className="w-2.5 h-2.5" style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }} />
                            </div>
                            {/* Search Icon */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'searching' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <FiSearch className="w-2.5 h-2.5" style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }} />
                            </div>
                            {/* Heart Icon */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'copied' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <FiHeart className="w-2.5 h-2.5 fill-rose-500 text-rose-500 drop-shadow-[0_0_3px_#f43f5e]" />
                            </div>
                            {/* Download Icon */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'downloading' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <FiDownload className="w-2.5 h-2.5" style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }} />
                            </div>
                            {/* Struggle Right Eye (<) */}
                            <div 
                                className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'loading' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} text-[11px] font-extrabold font-mono select-none translate-y-[-0.5px]`}
                                style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }}
                            >
                                &lt;
                            </div>
                            {/* Dragged Cross */}
                            <div 
                                className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'dragged' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} text-[8px] font-extrabold font-mono`}
                                style={{ color: getActiveColor() }}
                            >
                                X
                            </div>
                            {/* Happy Curve ^ */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${emotion === 'happy' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} text-neutral-950 font-extrabold text-[10px] select-none translate-y-[-1px]`}>
                                ^
                            </div>
                            {/* Question Right Eye - Question Mark */}
                            <div 
                                className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${state === 'question' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} text-[10px] font-extrabold font-sans`}
                                style={{ color: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }}
                            >
                                ?
                            </div>
                            {/* Wink line */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${emotion === 'wink' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                <span className="w-2.5 h-[2px] rounded-full" style={{ backgroundColor: getActiveColor(), filter: `drop-shadow(0 0 3px ${getActiveColor()})` }}></span>
                            </div>
                            {/* Thinking Pupil inside capsule */}
                            <div className={`absolute w-1.5 h-1.5 rounded-full bg-neutral-950 transition-all duration-300 ${emotion === 'thinking' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} style={{ transform: 'translate(1px, -2px)' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render mouth visual states
    const renderMouth = () => {
        const getMouthActive = () => {
            if (state === 'sleep') return 'circle';
            if (state === 'dragged' || emotion === 'thinking' || state === 'loading') return 'line';
            if (state === 'question') return 'curved';
            if (showSpeechBubble || emotion === 'gasp') return 'normal';
            if (emotion === 'wink') return 'curved';
            return 'smile';
        };

        const activeMouth = getMouthActive();

        return (
            <div className="relative w-12 h-[12px] flex justify-center items-center pointer-events-none">
                {/* Normal capsule mouth */}
                <div className={`absolute w-[5px] h-[10px] border-[2px] rounded-full transition-all duration-300 ${activeMouth === 'normal' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} style={{ borderColor: getActiveColor() }}></div>

                {/* Small line mouth */}
                <div className={`absolute h-[2.5px] rounded-full transition-all duration-300 ${activeMouth === 'line' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} style={{ width: '10px', backgroundColor: getActiveColor() }}></div>

                {/* Circle dot mouth */}
                <div className={`absolute w-[6px] h-[6px] border-[2px] rounded-full transition-all duration-300 ${activeMouth === 'circle' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} style={{ borderColor: getActiveColor() }}></div>

                {/* Smile mouth */}
                <div className={`absolute w-[13px] h-[6px] border-b-[2px] rounded-b-full transition-all duration-300 ${activeMouth === 'smile' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} style={{ borderBottomColor: getActiveColor() }}></div>

                {/* Curved double mouth */}
                <div className={`absolute flex justify-center transition-all duration-300 ${activeMouth === 'curved' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} style={{ filter: `drop-shadow(0 0 3px ${getActiveColor()})` }}>
                    <div className="w-[6px] h-[6px] border-b-[2px] border-r-[2px] rounded-br-full transform rotate-45 translate-x-[0.5px]" style={{ borderBottomColor: getActiveColor(), borderRightColor: getActiveColor() }}></div>
                    <div className="w-[6px] h-[6px] border-b-[2px] border-l-[2px] rounded-bl-full transform -rotate-45 -translate-x-[0.5px]" style={{ borderBottomColor: getActiveColor(), borderLeftColor: getActiveColor() }}></div>
                </div>
            </div>
        );
    };

    // Render speech bubble state
    const renderSpeechBubble = () => {
        if (!showSpeechBubble) return null;
        return (
            <div
                className="absolute bg-neutral-900/95 text-white border border-white/15 px-3 py-2 rounded-xl text-xs font-semibold w-48 shadow-2xl pointer-events-none select-none animate-in fade-in zoom-in duration-200 text-center"
                style={{
                    bottom: '82px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                }}
            >
                {speechText}
                <div
                    className="absolute border-t-8 border-t-neutral-900 border-x-8 border-x-transparent"
                    style={{
                        bottom: '-7px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                    }}
                />
            </div>
        );
    };

    // Render restore launcher bubble when hidden
    if (hidden) {
        return (
            <>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes pet-float-zzz {
                        0% { transform: translateY(0) scale(0.6); opacity: 0; }
                        20% { opacity: 0.8; }
                        100% { transform: translateY(-30px) translateX(12px) scale(1.1); opacity: 0; }
                    }
                    @keyframes pet-breathe {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.04, 0.96) translateY(1px); }
                    }
                    @keyframes pet-tremble {
                        0%, 100% { transform: translate(0, 0); }
                        20% { transform: translate(-2px, 1px); }
                        40% { transform: translate(2px, -1px); }
                        60% { transform: translate(-1px, -1px); }
                        80% { transform: translate(1px, 2px); }
                    }
                    @keyframes pet-blink {
                        0%, 90%, 100% { transform: scaleY(1); }
                        95% { transform: scaleY(0.1); }
                    }
                    @keyframes pet-float {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-5px); }
                    }
                `}} />

                <button
                    onClick={handleRestore}
                    className={`fixed bottom-4 right-4 z-[99999] flex items-center justify-center p-2.5 rounded-full bg-neutral-950/80 hover:bg-neutral-900 border hover:text-white shadow-lg cursor-pointer transition-all duration-300 group hover:scale-110 ${themeColor.border}`}
                    title="Wake Assistant Pet"
                >
                    <FiPrinter className="w-4 h-4 animate-bounce" />
                    <span className={`w-2 h-2 absolute top-0.5 right-0.5 rounded-full animate-ping ${themeColor.pingBg} ${themeColor.pingShadow}`}></span>
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 group-hover:pl-2 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap">
                        Assistant
                    </span>
                </button>
            </>
        );
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes pet-float-zzz {
                    0% { transform: translateY(0) scale(0.6); opacity: 0; }
                    20% { opacity: 0.8; }
                    100% { transform: translateY(-30px) translateX(12px) scale(1.1); opacity: 0; }
                }
                @keyframes pet-breathe {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.04, 0.96) translateY(1px); }
                }
                @keyframes pet-tremble {
                    0%, 100% { transform: translate(0, 0); }
                    20% { transform: translate(-2px, 1px); }
                    40% { transform: translate(2px, -1px); }
                    60% { transform: translate(-1px, -1px); }
                    80% { transform: translate(1px, 2px); }
                }
                @keyframes pet-blink {
                    0%, 90%, 100% { transform: scaleY(1); }
                    95% { transform: scaleY(0.1); }
                }
                @keyframes pet-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                @keyframes pet-walk-sway {
                    0%, 100% { transform: rotate(0deg) translateY(0); }
                    25% { transform: rotate(8deg) translateY(-6px); }
                    50% { transform: rotate(0deg) translateY(0); }
                    75% { transform: rotate(-8deg) translateY(-6px); }
                }
                @keyframes pet-drag-wobble {
                    0%, 100% { transform: rotate(0deg) scale(1); }
                    25% { transform: rotate(10deg) scale(1.08, 0.92); }
                    50% { transform: rotate(0deg) scale(0.92, 1.08); }
                    75% { transform: rotate(-10deg) scale(1.08, 0.92); }
                }
            `}} />

            <div
                ref={petRef}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onClick={handlePetClick}
                className="fixed z-[99999] select-none cursor-grab active:cursor-grabbing group/pet"
                style={{
                    width: '96px',
                    height: '76px',
                    animation: state === 'sleep' 
                        ? 'pet-breathe 3.5s ease-in-out infinite' 
                        : state === 'walking'
                            ? 'pet-walk-sway 0.8s ease-in-out infinite'
                            : state === 'dragged'
                                ? 'pet-drag-wobble 0.4s ease-in-out infinite'
                                : state === 'loading' 
                                    ? 'pet-tremble 0.15s infinite' 
                                    : 'none',
                }}
            >
                {/* Speech Bubble */}
                {renderSpeechBubble()}

                {/* Zzz Floatings */}
                {zzzList.map(zzz => (
                    <span
                        key={zzz.id}
                        className="absolute font-bold font-mono pointer-events-none select-none"
                        style={{ ...zzz.style, color: getActiveColor() }}
                    >
                        Z
                    </span>
                ))}

                {/* Main Body Chassis */}
                <div 
                    className="w-full h-full bg-[#080808] border-[2px] rounded-[22px] flex flex-col items-center justify-center gap-2 p-1.5 relative overflow-hidden transition-all duration-300"
                    style={{
                        animation: ['sleep', 'walking', 'dragged', 'loading'].includes(state) ? 'none' : 'pet-float 2.5s ease-in-out infinite',
                        borderColor: state === 'loading' ? getActiveColor() : '#222',
                        boxShadow: state === 'loading' 
                            ? `0 0 30px 10px ${getActiveShadow()}, inset 0 0 15px rgba(0,0,0,1)` 
                            : '0 0 30px 10px rgba(0,0,0,0.6), inset 0 0 15px rgba(0,0,0,1)'
                    }}
                >
                    {/* Gloss top overlay */}
                    <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/15 via-white/5 to-transparent pointer-events-none rounded-t-[20px] z-10"></div>
                    {/* Hover controls */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClose();
                        }}
                        className="close-btn absolute -top-1.5 -right-1.5 bg-neutral-950 hover:bg-neutral-900 border border-white/10 hover:border-white/20 p-0.5 rounded-full text-white/50 hover:text-white opacity-0 group-hover/pet:opacity-100 transition-opacity duration-200 cursor-pointer shadow-lg z-10"
                        title="Hide Assistant"
                    >
                        <FiX className="w-3 h-3" />
                    </button>

                    {/* Robot Eyes Row */}
                    <div className="flex items-center justify-center h-6 pointer-events-none">
                        {renderEyes()}
                    </div>

                    {/* Robot Mouth */}
                    <div className="flex items-center justify-center h-5 pointer-events-none">
                        {renderMouth()}
                    </div>

                    {/* Subtle micro decorative elements (like audio speaker or light sensors) */}
                    {/* <div className="absolute bottom-1.5 flex gap-1 justify-center w-full pointer-events-none">
                        <span className="w-1 h-0.5 bg-neutral-800 rounded-full"></span>
                        <span className="w-1 h-0.5 bg-neutral-800 rounded-full"></span>
                        <span className="w-1 h-0.5 bg-neutral-800 rounded-full"></span>
                    </div> */}
                </div>
            </div>
        </>
    );
}
