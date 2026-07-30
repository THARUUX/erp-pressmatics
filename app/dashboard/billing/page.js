'use client';

import { useState, useEffect } from 'react';
import { FiCreditCard, FiTrash2, FiUser, FiCalendar, FiLock, FiPlus } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

// Inline Visa SVG Logo
const VisaLogo = () => (
    <svg className="h-6 w-auto text-white" viewBox="0 0 24 8" fill="currentColor">
        <path d="M0 0h3.5L5.7 5.5 8 0h3.2L7.2 8H4L1.8 2.5 0.5 5.5 0 0zm11.5 0h2.8l-2 8h-2.8l2-8zm5.2 0h-2.5l2.2 8h2.5l-2.2-8zm4.8 0h-2.3c-.6 0-1.1.3-1.3.8L15.3 8h2.8l.6-1.5h3l.3 1.5h2.5l-2.2-8z" />
    </svg>
);

// Inline Mastercard Logo
const MastercardLogo = () => (
    <div className="flex items-center">
        <div className="w-5 h-5 rounded-full bg-[#eb001b] z-10" />
        <div className="w-5 h-5 rounded-full bg-[#ff5f00] -ml-2.5 z-0" />
    </div>
);

// Luhn Validation algorithm
function validateLuhn(num) {
    const sanitized = num.replace(/\D/g, '');
    let sum = 0;
    let shouldDouble = false;
    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

export default function BillingPage() {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form inputs state
    const [cardholder, setCardholder] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');

    // Input errors
    const [errors, setErrors] = useState({});

    // Active Card Type detected dynamically
    const [detectedType, setDetectedType] = useState('generic');

    // Focused element for 3D card flip animation
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        fetchCards();
    }, []);

    // Detect card type on card number change
    useEffect(() => {
        const cleanNum = cardNumber.replace(/\D/g, '');
        if (cleanNum.startsWith('4')) {
            setDetectedType('visa');
        } else if (/^5[1-5]|^2[2-7]/.test(cleanNum)) {
            setDetectedType('mastercard');
        } else {
            setDetectedType('generic');
        }
    }, [cardNumber]);

    const fetchCards = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/billing');
            if (res.ok) {
                const data = await res.json();
                setCards(data);
            } else {
                toast.error('Failed to load saved cards');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error fetching billing info');
        } finally {
            setLoading(false);
        }
    };

    // Format Card Number (space every 4 digits)
    const handleCardNumberChange = (e) => {
        const val = e.target.value.replace(/\D/g, '');
        const formatted = val.replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
        setCardNumber(formatted);
        setErrors(prev => ({ ...prev, cardNumber: null }));
    };

    // Format Expiry (MM/YY)
    const handleExpiryChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) {
            val = `${val.slice(0, 2)}/${val.slice(2, 4)}`;
        }
        setExpiry(val.slice(0, 5));
        setErrors(prev => ({ ...prev, expiry: null }));
    };

    // Handle CVV Change
    const handleCvvChange = (e) => {
        const val = e.target.value.replace(/\D/g, '');
        setCvv(val.slice(0, 4));
        setErrors(prev => ({ ...prev, cvv: null }));
    };

    const validateForm = () => {
        const nextErrors = {};

        if (!cardholder.trim()) {
            nextErrors.cardholder = 'Cardholder name is required';
        }

        const cleanCard = cardNumber.replace(/\D/g, '');
        if (!cleanCard) {
            nextErrors.cardNumber = 'Card number is required';
        } else if (cleanCard.length < 13 || cleanCard.length > 19) {
            nextErrors.cardNumber = 'Card number must be 13-19 digits';
        } else if (!validateLuhn(cleanCard)) {
            nextErrors.cardNumber = 'Invalid card number (checksum failed)';
        } else if (detectedType === 'generic') {
            nextErrors.cardNumber = 'Only Visa and Mastercard are accepted';
        }

        const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
        if (!expiry) {
            nextErrors.expiry = 'Expiration date is required';
        } else if (!expiryRegex.test(expiry)) {
            nextErrors.expiry = 'Use MM/YY format';
        } else {
            const [_, month, year] = expiry.match(expiryRegex);
            const currentYear = parseInt(new Date().getFullYear().toString().slice(-2), 10);
            const currentMonth = new Date().getMonth() + 1;
            const yearInt = parseInt(year, 10);
            const monthInt = parseInt(month, 10);
            if (yearInt < currentYear || (yearInt === currentYear && monthInt < currentMonth)) {
                nextErrors.expiry = 'Card has expired';
            }
        }

        if (!cvv) {
            nextErrors.cvv = 'CVV is required';
        } else if (cvv.length < 3 || cvv.length > 4) {
            nextErrors.cvv = 'CVV must be 3 or 4 digits';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSaveCard = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            toast.error('Please correct the errors in the form');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardholder_name: cardholder,
                    card_number: cardNumber,
                    expiry,
                    cvv
                })
            });

            if (res.ok) {
                toast.success('Card added successfully');
                // Reset form
                setCardholder('');
                setCardNumber('');
                setExpiry('');
                setCvv('');
                fetchCards();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save card');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error. Failed to save card.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCard = async (id) => {
        if (!confirm('Are you sure you want to remove this card?')) return;

        try {
            const res = await fetch(`/api/billing?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast.success('Card removed successfully');
                fetchCards();
            } else {
                toast.error('Failed to remove card');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error. Failed to remove card.');
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
            <header className="mb-8">
                <h1 className="text-2xl font-bold tracking-tighter flex items-center gap-2">
                    <FiCreditCard className="text-blue-500" />
                    Billing & Payment Settings
                </h1>
                <p className="text-xs text-gray-500 mt-1">Manage active Mastercard and Visa cards securely in the system</p>
            </header>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Left: Card Setup Form & 3D Visualizer */}
                <div className="space-y-8">
                    {/* Premium 3D Credit Card Visualizer */}
                    <div className="flex justify-center py-4">
                        <div 
                            className="w-full max-w-[350px] h-[210px] [perspective:1000px]"
                        >
                            <div 
                                className={`w-full h-full relative transition-transform duration-700 [transform-style:preserve-3d] ${
                                    isFlipped ? '[transform:rotateY(180deg)]' : ''
                                }`}
                            >
                                {/* Card Front */}
                                <div 
                                    className={`absolute inset-0 w-full h-full rounded-2xl p-6 flex flex-col justify-between [backface-visibility:hidden] shadow-2xl border border-white/10 select-none ${
                                        detectedType === 'visa' 
                                            ? 'bg-gradient-to-br from-indigo-900/90 via-blue-950/80 to-slate-900/90' 
                                            : detectedType === 'mastercard'
                                                ? 'bg-gradient-to-br from-red-950/80 via-amber-950/70 to-zinc-900/90'
                                                : 'bg-gradient-to-br from-gray-900/80 via-slate-950/90 to-zinc-950/80'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        {/* Golden Chip */}
                                        <div className="w-11 h-8 bg-gradient-to-r from-amber-400 to-amber-200 rounded-md border border-amber-300/30 flex flex-col justify-between p-1.5 opacity-80">
                                            <div className="w-full h-0.5 bg-black/10" />
                                            <div className="w-full h-0.5 bg-black/10" />
                                            <div className="w-full h-0.5 bg-black/10" />
                                        </div>
                                        {/* Card Logo */}
                                        <div>
                                            {detectedType === 'visa' && <VisaLogo />}
                                            {detectedType === 'mastercard' && <MastercardLogo />}
                                            {detectedType === 'generic' && <FiCreditCard className="w-7 h-7 text-gray-500" />}
                                        </div>
                                    </div>

                                    {/* Card Number */}
                                    <div className="text-xl font-bold tracking-[0.2em] font-mono mt-4 text-white drop-shadow-md">
                                        {cardNumber || '•••• •••• •••• ••••'}
                                    </div>

                                    {/* Cardholder & Expiry */}
                                    <div className="flex justify-between items-end mt-2">
                                        <div className="min-w-0">
                                            <div className="text-[9px] uppercase tracking-wider text-gray-500">Cardholder Name</div>
                                            <div className="text-xs font-semibold uppercase truncate text-white drop-shadow">
                                                {cardholder || 'Cardholder Name'}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-[9px] uppercase tracking-wider text-gray-500">Expires</div>
                                            <div className="text-xs font-semibold font-mono text-white drop-shadow">
                                                {expiry || 'MM/YY'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Back */}
                                <div 
                                    className={`absolute inset-0 w-full h-full rounded-2xl py-6 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)] shadow-2xl border border-white/10 select-none ${
                                        detectedType === 'visa' 
                                            ? 'bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-900' 
                                            : detectedType === 'mastercard'
                                                ? 'bg-gradient-to-br from-red-950 via-amber-950 to-zinc-900'
                                                : 'bg-gradient-to-br from-gray-900 via-slate-950 to-zinc-950'
                                    }`}
                                >
                                    {/* Magnetic Strip */}
                                    <div className="w-full h-11 bg-black/80 mt-2" />

                                    {/* Signature and CVV box */}
                                    <div className="px-6 space-y-1">
                                        <div className="text-[8px] uppercase tracking-wider text-gray-500 text-right mr-2">Authorized Signature</div>
                                        <div className="flex items-center">
                                            <div className="flex-1 h-9 bg-white/20 backdrop-blur rounded-l px-3 flex items-center italic text-sm text-gray-400 select-none pointer-events-none">
                                                Pressmatics ERP
                                            </div>
                                            <div className="w-14 h-9 bg-white text-black font-semibold rounded-r flex items-center justify-center font-mono text-sm tracking-wider">
                                                {cvv || '•••'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Small print */}
                                    <div className="px-6 text-[7px] text-gray-600 text-center">
                                        This card remains the property of the issuer. For verification and internal ERP billing.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card Form */}
                    <form onSubmit={handleSaveCard} className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 space-y-4">
                        <h2 className="text-lg font-bold border-b border-white/10 pb-2">Add Payment Method</h2>
                        
                        <div>
                            <Input
                                label="Cardholder Name"
                                value={cardholder}
                                onChange={(e) => {
                                    setCardholder(e.target.value);
                                    setErrors(prev => ({ ...prev, cardholder: null }));
                                }}
                                error={errors.cardholder}
                                placeholder="e.g. John Doe"
                                icon={FiUser}
                            />
                        </div>

                        <div>
                            <Input
                                label="Card Number"
                                value={cardNumber}
                                onChange={handleCardNumberChange}
                                error={errors.cardNumber}
                                placeholder="4111 2222 3333 4444"
                                maxLength={19}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Input
                                    label="Expiration Date"
                                    value={expiry}
                                    onChange={handleExpiryChange}
                                    error={errors.expiry}
                                    placeholder="MM/YY"
                                    maxLength={5}
                                />
                            </div>
                            <div>
                                <Input
                                    label="CVV / Security Code"
                                    value={cvv}
                                    onChange={handleCvvChange}
                                    onFocus={() => setIsFlipped(true)}
                                    onBlur={() => setIsFlipped(false)}
                                    error={errors.cvv}
                                    placeholder="e.g. 123"
                                    maxLength={4}
                                    type="password"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                isLoading={saving}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 border border-blue-400/20"
                            >
                                <FiPlus className="w-4 h-4" /> Save Card Details
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Right: Saved Cards List */}
                <div className="space-y-6">
                    <section className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 h-full">
                        <h2 className="text-lg font-bold border-b border-white/10 pb-2 mb-4">Saved Cards</h2>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
                                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                <div className="text-xs">Loading billing details...</div>
                            </div>
                        ) : cards.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-500 border border-dashed border-white/10 rounded-xl">
                                <FiCreditCard className="w-12 h-12 text-gray-600 mb-3" />
                                <p className="text-sm font-semibold">No cards saved yet</p>
                                <p className="text-xs text-gray-600 mt-1">Add your Visa or Mastercard to get started</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {cards.map((card) => (
                                    <div 
                                        key={card.id}
                                        className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            {/* Small Brand Logo Box */}
                                            <div className="w-12 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                                                {card.card_type === 'visa' && <VisaLogo />}
                                                {card.card_type === 'mastercard' && <MastercardLogo />}
                                            </div>
                                            
                                            {/* Card details summary */}
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold font-mono tracking-wider text-white">
                                                    {card.card_number_masked}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-gray-500 uppercase truncate max-w-[120px]">
                                                        {card.cardholder_name}
                                                    </span>
                                                    <span className="text-gray-600 text-[10px]">•</span>
                                                    <span className="text-[10px] text-gray-500 font-mono">
                                                        Exp: {card.expiry}
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        Active
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                            onClick={() => handleDeleteCard(card.id)}
                                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all"
                                            title="Delete Card"
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Security Disclaimer */}
                        <div className="mt-8 border-t border-white/[0.06] pt-4 flex gap-3 text-gray-500 text-[10px] leading-relaxed">
                            <FiLock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                                <strong className="text-gray-400 font-medium">Secured Data Storage</strong>
                                <p className="mt-0.5">Card details are saved directly in the workspace database. Form inputs include Luhn-check validation for secure transaction initialization.</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
