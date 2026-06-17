export default function GuidePage() {
    const sections = [
        {
            icon: '📐',
            title: 'Component Quantity — Multiple Units per Product',
            color: '#7c3aed',
            tips: [
                {
                    label: 'When 1 unit contains 2 of a component',
                    description: 'e.g. Hard Cover book has 2 Chip Boards or 2 End Pages',
                    options: [
                        { tag: 'Option 1', text: 'Double the component quantity — not recommended when copying products.' },
                        { tag: 'Option 2 ✓', text: 'Change sides to "Both Side" → adjust page count → double the page count → set sides back to "One Side".' },
                    ],
                },
            ],
        },
        {
            icon: '📄',
            title: 'Non-Standard Cut Sheet Sizes',
            color: '#0891b2',
            tips: [
                {
                    label: 'Using a different cut sheet size than standard',
                    description: 'e.g. Using 12 × 18 sheets on SM74 for A5 Hard Cover print paper.',
                    options: [
                        { tag: 'Input', text: 'Use the "Cut Sheets / Full Sheet" input — enter how many cut sheets can be obtained from one full A1 sheet.' },
                    ],
                },
            ],
        },
        {
            icon: '🧱',
            title: 'Material-Only Components (No Machine)',
            color: '#059669',
            tips: [
                {
                    label: 'Components that use material only with no machine',
                    description: 'e.g. End Pages, Chip Boards for Hard Cover books.',
                    options: [
                        { tag: 'Setup', text: 'Set "Machine" to "Select Machine", and set both "Plate Cost/unit" and "Impression Cost" to 0.' },
                    ],
                },
            ],
        },
        {
            icon: '📏',
            title: 'Dimensions & Imposition',
            color: '#d97706',
            tips: [
                {
                    label: 'Always use correct dimensions',
                    description: 'Accurate dimensions give better imposition layouts and correct pricing calculations.',
                    options: [],
                },
            ],
        },
        {
            icon: '🔄',
            title: 'Back & Back Printing',
            color: '#dc2626',
            tips: [
                {
                    label: 'Back & Back tick option',
                    description: '',
                    options: [
                        { tag: '✓ Enable', text: 'Only for one-colour back-and-back printing.' },
                        { tag: '✗ Disable', text: 'Do NOT enable for multi-colour back-and-backs.' },
                    ],
                },
            ],
        },
        {
            icon: '🏷️',
            title: 'Component Naming Conventions',
            color: '#7c3aed',
            tips: [
                {
                    label: 'Component names determine which input fields appear',
                    description: 'The system detects component type by its name.',
                    options: [
                        { tag: '"Cover"', text: 'Name must be exactly "Cover" to get standard cover inputs.' },
                        { tag: '"Inner"', text: 'Name must include "Inner" to get standard inner page inputs.' },
                        { tag: '"Finishing"', text: 'Name must be exactly "Finishing" to get standard finishing inputs.' },
                    ],
                },
            ],
        },
        {
            icon: '⚗️',
            title: 'Wastage Calculation',
            color: '#0891b2',
            tips: [
                {
                    label: 'Choose the right wastage method per component type',
                    description: 'Covers print as individual sheets; other components print as sets.',
                    options: [
                        { tag: 'Covers', text: 'Use "Wastage Cutsheets" — covers print individually, not as sets.' },
                        { tag: 'Inners / Inserts / Materials', text: 'Use "Sets / Wastage Sheets" — these print in sets.' },
                    ],
                },
            ],
        },
        {
            icon: '⚠️',
            title: 'Important Warning',
            color: '#ef4444',
            warning: true,
            tips: [
                {
                    label: 'Do NOT delete estimations that are linked to Quotations!',
                    description: 'Deleting a linked estimation will break the associated quotation data.',
                    options: [],
                },
            ],
        },
    ];

    return (
        <div className="text-white">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tighter">User Guide</h1>
                <p className="text-gray-400 text-sm mt-1">Tips and conventions for creating accurate estimations</p>
            </header>

            {/* Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '1.25rem' }}>
                {sections.map((section, i) => (
                    <div
                        key={i}
                        style={{
                            background: section.warning
                                ? 'rgba(239,68,68,0.06)'
                                : 'rgba(0,0,0,0.4)',
                            border: `1px solid ${section.warning ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '14px',
                            padding: '1.5rem',
                            backdropFilter: 'blur(12px)',
                        }}
                    >
                        {/* Card header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: '10px',
                                background: `${section.color}22`,
                                border: `1px solid ${section.color}44`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem',
                                flexShrink: 0,
                            }}>
                                {section.icon}
                            </div>
                            <h2 style={{
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                color: section.warning ? '#f87171' : '#ffffff',
                                margin: 0,
                                lineHeight: 1.3,
                            }}>
                                {section.title}
                            </h2>
                        </div>

                        {/* Tips */}
                        {section.tips.map((tip, j) => (
                            <div key={j}>
                                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: '0.35rem' }}>
                                    {tip.label}
                                </p>
                                {tip.description && (
                                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                                        {tip.description}
                                    </p>
                                )}
                                {tip.options.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {tip.options.map((opt, k) => (
                                            <div key={k} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '6px',
                                                    background: `${section.color}22`,
                                                    border: `1px solid ${section.color}44`,
                                                    color: section.color === '#dc2626' || section.warning ? '#f87171' : section.color === '#059669' ? '#34d399' : section.color === '#0891b2' ? '#67e8f9' : section.color === '#d97706' ? '#fcd34d' : '#c4b5fd',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0,
                                                    marginTop: '1px',
                                                }}>
                                                    {opt.tag}
                                                </span>
                                                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                                                    {opt.text}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Footer note */}
            <div style={{
                marginTop: '2rem',
                padding: '1rem 1.25rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.3)',
                textAlign: 'center',
            }}>
                Pressmatics ERP · Internal Use Only
            </div>
        </div>
    );
}
