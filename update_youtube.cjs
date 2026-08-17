const fs = require('fs');
let code = fs.readFileSync('src/components/YoutubeSearch.tsx', 'utf8');

code = code.replace("const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());", 
`const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(state.uiState?.youtubeSearchSelectedIds || []));`);

code = code.replace("const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());", 
`const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set(state.uiState?.youtubeSearchManualSelectedIds || []));`);

code = code.replace("const [comparingGroup, setComparingGroup] = useState<SimilarityResult[] | null>(null);", 
`const [comparingGroup, setComparingGroup] = useState<SimilarityResult[] | null>(state.uiState?.youtubeSearchComparingGroup || null);`);

const syncCode = `
  // Sync local states with global state for export/import compatibility
  useEffect(() => {
    updateUiState({
      youtubeSearchSelectedIds: Array.from(selectedIds),
      youtubeSearchManualSelectedIds: Array.from(manualSelectedIds),
      youtubeSearchComparingGroup: comparingGroup,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, manualSelectedIds, comparingGroup]);

  useEffect(() => {
    if (state.uiState?.youtubeSearchSelectedIds) {
      setSelectedIds(prev => {
        const next = new Set(state.uiState!.youtubeSearchSelectedIds);
        if (prev.size !== next.size || [...prev].some(id => !next.has(id))) return next;
        return prev;
      });
    }
    if (state.uiState?.youtubeSearchManualSelectedIds) {
      setManualSelectedIds(prev => {
        const next = new Set(state.uiState!.youtubeSearchManualSelectedIds);
        if (prev.size !== next.size || [...prev].some(id => !next.has(id))) return next;
        return prev;
      });
    }
    if (state.uiState?.youtubeSearchComparingGroup !== undefined) {
      setComparingGroup(state.uiState.youtubeSearchComparingGroup);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.uiState?.youtubeSearchSelectedIds, state.uiState?.youtubeSearchManualSelectedIds, state.uiState?.youtubeSearchComparingGroup]);
`;

code = code.replace("const currentSinger = state.singers.find(s => s.name === keyword);", syncCode + "\n  const currentSinger = state.singers.find(s => s.name === keyword);");

fs.writeFileSync('src/components/YoutubeSearch.tsx', code);
