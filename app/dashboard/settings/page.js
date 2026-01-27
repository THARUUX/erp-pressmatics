'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/components/SettingsContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function SettingsPage() {
    const { settings, updateSetting } = useSettings();
    const [currency, setCurrency] = useState(settings.currency || '$');
    const [template, setTemplate] = useState(settings.item_code_template || 'INV-{0000}');
    const [seq, setSeq] = useState(settings.item_code_seq || '1000');
    const [theme, setTheme] = useState(settings.system_theme || 'default');
    const [custIdTemplate, setCustIdTemplate] = useState(settings.customer_id_template || 'CUST-{000}');
    const [custIdSeq, setCustIdSeq] = useState(settings.customer_id_seq || '1');
    const [quoteIdTemplate, setQuoteIdTemplate] = useState(settings.quotation_id_template || 'QTN-{0000}');
    const [quoteIdSeq, setQuoteIdSeq] = useState(settings.quotation_id_seq || '1');
    const [pageLimit, setPageLimit] = useState(settings.list_item_limit || '10');
    const [taxRate, setTaxRate] = useState(settings.default_tax_percentage || '0');

    // Document Settings
    const [companyName, setCompanyName] = useState(settings.company_name || '');
    const [companyAddress, setCompanyAddress] = useState(settings.company_address || '');
    const [companyLogo, setCompanyLogo] = useState(settings.company_logo || '');
    const [companySignature, setCompanySignature] = useState(settings.company_signature || '');
    const [defaultTerms, setDefaultTerms] = useState(settings.default_terms || '');
    const [showGrandTotal, setShowGrandTotal] = useState(settings.show_grand_total === 'false' ? false : true);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setCurrency(settings.currency);
        setTemplate(settings.item_code_template || 'INV-{0000}');
        setSeq(settings.item_code_seq || '1000');
        setTheme(settings.system_theme || 'default');
        setCustIdTemplate(settings.customer_id_template || 'CUST-{000}');
        setCustIdSeq(settings.customer_id_seq || '1');
        setQuoteIdTemplate(settings.quotation_id_template || 'QTN-{0000}');
        setQuoteIdSeq(settings.quotation_id_seq || '1');
        setPageLimit(settings.list_item_limit || '10');
        setTaxRate(settings.default_tax_percentage || '0');

        // Document
        setCompanyName(settings.company_name || '');
        setCompanyAddress(settings.company_address || '');
        setCompanyLogo(settings.company_logo || '');
        setCompanySignature(settings.company_signature || '');
        setDefaultTerms(settings.default_terms || '');
        setShowGrandTotal(settings.show_grand_total === 'false' ? false : true);
    }, [settings]);

    const handleSave = async () => {
        setSaving(true);
        const updates = [
            ['currency', currency],
            ['item_code_template', template],
            ['item_code_seq', seq],
            ['system_theme', theme],
            ['customer_id_template', custIdTemplate],
            ['customer_id_seq', custIdSeq],
            ['quotation_id_template', quoteIdTemplate],
            ['quotation_id_seq', quoteIdSeq],
            ['list_item_limit', pageLimit],
            ['default_tax_percentage', taxRate],
            ['company_name', companyName],
            ['company_address', companyAddress],
            ['company_logo', companyLogo],
            ['company_signature', companySignature],
            ['default_terms', defaultTerms],
            ['show_grand_total', showGrandTotal ? 'true' : 'false']
        ];

        let success = true;
        for (const [key, val] of updates) {
            const s = await updateSetting(key, val);
            if (!s) success = false;
        }

        if (success) {
            alert('Settings saved!');
        } else {
            alert('Some settings failed to save');
        }
        setSaving(false);
    };

    return (
        <div className="text-white">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tighter">System Settings</h1>
            </header>

            <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 max-w-2xl">
                <h2 className="text-lg font-semibold mb-6 border-b border-white/10 pb-2">General Configuration</h2>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Currency Symbol</label>
                        <div className="flex gap-4">
                            <Input
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="bg-secondary border-white/10 w-32"
                                placeholder="$"
                            />
                            <div className="text-gray-500 text-sm flex items-center">
                                (Used in all price displays)
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Item Code Template</label>
                        <div className="flex gap-4">
                            <Input
                                value={template}
                                onChange={(e) => setTemplate(e.target.value)}
                                className="bg-secondary border-white/10 w-full"
                                placeholder="INV-{0000}"
                            />
                        </div>
                        <p className="text-gray-500 text-xs mt-1">
                            Use <code>{`{0000}`}</code> for padded sequence (e.g. 0001) or <code>{`{SEQ}`}</code> for raw number.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Next Sequence Number</label>
                        <div className="flex gap-4">
                            <Input
                                type="number"
                                value={seq}
                                onChange={(e) => setSeq(e.target.value)}
                                className="bg-secondary border-white/10 w-32"
                                placeholder="1001"
                            />
                            <div className="text-gray-500 text-sm flex items-center">
                                (Will be used for the next generated code)
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/40 p-6 rounded-xl border border-white/10 space-y-4">
                        <h2 className="text-xl font-bold border-b border-white/10 pb-4">Tax Configuration</h2>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Default Tax Percentage (%)</label>
                            <input
                                type="number"
                                value={taxRate}
                                onChange={(e) => setTaxRate(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-sm w-full"
                                placeholder="e.g. 15"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div className="bg-black/40 p-6 rounded-xl border border-white/10 space-y-4">
                        <h2 className="text-xl font-bold border-b border-white/10 pb-4">Company Profile</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Company Name</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="bg-black/20 border border-white/10 rounded-lg p-2 text-sm w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Company Address</label>
                                <input
                                    type="text"
                                    value={companyAddress}
                                    onChange={(e) => setCompanyAddress(e.target.value)}
                                    className="bg-black/20 border border-white/10 rounded-lg p-2 text-sm w-full"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-gray-400 text-sm mb-1">Company Logo</label>
                                <div className="flex items-center gap-4">
                                    {companyLogo && (
                                        <div className="relative group">
                                            <img src={companyLogo} alt="Logo Preview" className="h-16 w-auto object-contain bg-white rounded p-1" />
                                            <button
                                                onClick={() => setCompanyLogo('')}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    // Max 2MB
                                                    if (file.size > 2 * 1024 * 1024) {
                                                        alert("File size must be less than 2MB");
                                                        return;
                                                    }
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setCompanyLogo(reader.result);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="block w-full text-sm text-gray-400
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-white/10 file:text-white
                                                hover:file:bg-white/20
                                                cursor-pointer"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Upload image (Max 2MB). Stored in database.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-gray-400 text-sm mb-1">Signature Image</label>
                                <div className="flex items-center gap-4">
                                    {companySignature && (
                                        <div className="relative group">
                                            <img src={companySignature} alt="Signature Preview" className="h-16 w-auto object-contain bg-white rounded p-1" />
                                            <button
                                                onClick={() => setCompanySignature('')}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    if (file.size > 2 * 1024 * 1024) {
                                                        alert("File size must be less than 2MB");
                                                        return;
                                                    }
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setCompanySignature(reader.result);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="block w-full text-sm text-gray-400
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-white/10 file:text-white
                                                hover:file:bg-white/20
                                                cursor-pointer"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Upload image (Max 2MB). Stored in database.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/40 p-6 rounded-xl border border-white/10 space-y-4">
                        <h2 className="text-xl font-bold border-b border-white/10 pb-4">Document Defaults</h2>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Default Terms & Conditions</label>
                            <textarea
                                value={defaultTerms}
                                onChange={(e) => setDefaultTerms(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-sm w-full h-32 font-mono"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={showGrandTotal}
                                onChange={(e) => setShowGrandTotal(e.target.checked)}
                                className="w-4 h-4 rounded border-white/10 bg-black/20 focus:ring-blue-500"
                            />
                            <label className="text-gray-400 text-sm">Show Grand Total Section</label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">System Theme</label>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="bg-secondary border border-white/10 rounded-lg px-4 py-2 text-white w-full max-w-xs focus:outline-none focus:border-white/30"
                        >
                            <option value="default">Default Dark</option>
                            <option value="light">Light Mode</option>
                            <option value="blue">Deep Blue</option>
                            <option value="midnight">Midnight</option>
                        </select>
                    </div>

                    <div className="border-t border-white/10 pt-6"></div>
                    <h2 className="text-lg font-semibold mb-2">ID Templates</h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Customer ID Template</label>
                            <Input value={custIdTemplate} onChange={(e) => setCustIdTemplate(e.target.value)} className="bg-secondary border-white/10" placeholder="CUST-{000}" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Next Customer Seq</label>
                            <Input value={custIdSeq} onChange={(e) => setCustIdSeq(e.target.value)} className="bg-secondary border-white/10" type="number" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Quotation ID Template</label>
                            <Input value={quoteIdTemplate} onChange={(e) => setQuoteIdTemplate(e.target.value)} className="bg-secondary border-white/10" placeholder="QTN-{0000}" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Next Quotation Seq</label>
                            <Input value={quoteIdSeq} onChange={(e) => setQuoteIdSeq(e.target.value)} className="bg-secondary border-white/10" type="number" />
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-6"></div>
                    <h2 className="text-lg font-semibold mb-2">Pagination</h2>
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">List Items Per Page</label>
                        <Input value={pageLimit} onChange={(e) => setPageLimit(e.target.value)} className="bg-secondary border-white/10 w-32" type="number" placeholder="10" />
                    </div>

                    <div className="pt-4">
                        <Button onClick={handleSave} disabled={saving} className="bg-white text-black hover:bg-gray-200 min-w-[120px]">
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
