const evaluateMathExpression = (str) => {
    if (typeof str !== 'string') return str;
    const clean = str.replace(/[^0-9+\-*/().\s]/g, '');
    if (!clean.trim()) return '';
    try {
        const res = new Function(`return (${clean})`)();
        if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
            return String(Math.round(res * 100) / 100);
        }
    } catch {
        // fail silent
    }
    return str;
};

const tests = [
    { input: "2*2", expected: "4" },
    { input: "900/2", expected: "450" },
    { input: "50+50-10", expected: "90" },
    { input: "2.5*2", expected: "5" },
    { input: "10 * (2 + 3)", expected: "50" },
    { input: "abc", expected: "" },
    { input: "", expected: "" }
];

for (const t of tests) {
    const result = evaluateMathExpression(t.input);
    console.log(`Input: "${t.input}" -> Result: "${result}" (Expected: "${t.expected}") - ${result === t.expected ? 'PASS' : 'FAIL'}`);
}
