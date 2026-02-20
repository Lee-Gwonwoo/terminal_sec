import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { fetchAlertRules, saveAlertRule } from "../api";
export function AlertsSettingsPage() {
    const [rules, setRules] = useState([]);
    const [name, setName] = useState("");
    const [tool, setTool] = useState("news");
    const [enabled, setEnabled] = useState(true);
    const [browser, setBrowser] = useState(true);
    const [sound, setSound] = useState(false);
    const [email, setEmail] = useState(false);
    async function load() {
        setRules(await fetchAlertRules());
    }
    useEffect(() => {
        load().catch(console.error);
    }, []);
    async function create() {
        const methods = [];
        if (browser)
            methods.push("browser");
        if (sound)
            methods.push("sound");
        if (email)
            methods.push("email");
        await saveAlertRule({
            tool,
            name,
            enabled,
            methods,
            rule_json: { tool, scope: "saved-view-or-watchlist" }
        });
        setName("");
        await load();
    }
    return (_jsxs("section", { children: [_jsx("h2", { children: "Alert Settings" }), _jsxs("div", { className: "toolbar", children: [_jsx("input", { value: name, onChange: (event) => setName(event.target.value), placeholder: "Rule name" }), _jsxs("select", { value: tool, onChange: (event) => setTool(event.target.value), children: [_jsx("option", { value: "news", children: "News" }), _jsx("option", { value: "watchlists", children: "Watchlists" }), _jsx("option", { value: "calendar", children: "Calendar" })] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: enabled, onChange: (event) => setEnabled(event.target.checked) }), " Enabled"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: browser, onChange: (event) => setBrowser(event.target.checked) }), " Browser"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: sound, onChange: (event) => setSound(event.target.checked) }), " Sound"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: email, onChange: (event) => setEmail(event.target.checked) }), " Email"] }), _jsx("button", { onClick: create, children: "Save Rule" })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Tool" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Methods" })] }) }), _jsx("tbody", { children: rules.map((rule) => (_jsxs("tr", { children: [_jsx("td", { children: rule.name }), _jsx("td", { children: rule.tool }), _jsx("td", { children: rule.enabled ? "Enabled" : "Disabled" }), _jsx("td", { children: rule.methods.join(", ") })] }, rule.id))) })] }) })] }));
}
