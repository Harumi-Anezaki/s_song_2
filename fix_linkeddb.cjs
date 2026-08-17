const fs = require('fs');
let code = fs.readFileSync('src/components/LinkedDb.tsx', 'utf8');

// Replace local state with global state reference
code = code.replace(
  "const [activeViewId, setActiveViewId] = useState<string | null>(state.lastOpenViewId);",
  "const activeViewId = state.lastOpenViewId;\n  const setActiveViewId = (id: string | null) => setState(s => ({ ...s, lastOpenViewId: id }));"
);

// Remove the conflicting useEffects
code = code.replace(
  /useEffect\(\(\) => \{\s*if \(state\.lastOpenViewId && state\.lastOpenViewId !== activeViewId\) \{[\s\S]*?\}, \[state\.lastOpenViewId, state\.linkedViews\]\);\s*useEffect\(\(\) => \{\s*if \(state\.linkedViews\.length > 0 && !activeViewId\) \{[\s\S]*?\}, \[state\.linkedViews, activeViewId\]\);\s*useEffect\(\(\) => \{\s*if \(activeViewId\) \{[\s\S]*?\}, \[activeViewId, setState\]\);/,
  `useEffect(() => {
    if (state.linkedViews.length > 0) {
      if (!activeViewId || !state.linkedViews.some(v => v.id === activeViewId)) {
        setActiveViewId(state.linkedViews[0].id);
      }
    } else {
      setIsSetup(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.linkedViews, activeViewId]);`
);

fs.writeFileSync('src/components/LinkedDb.tsx', code);
