const fs = require('fs');
let code = fs.readFileSync('src/components/MusicPlayerMode.tsx', 'utf8');

if (!code.includes("import { useStore }")) {
    code = code.replace("import { cn } from '../lib/utils';", "import { cn } from '../lib/utils';\nimport { useStore } from '../store/StoreContext';");
}

if (!code.includes("const _playerState")) {
    code = code.replace("export function MusicPlayerMode({ songs, onClose }: MusicPlayerModeProps) {", 
`export function MusicPlayerMode({ songs, onClose }: MusicPlayerModeProps) {
  const { state, updateUiState } = useStore();
  const _playerState = state.uiState?.musicPlayer || {};`);

    code = code.replace("const [currentIndex, setCurrentIndex] = useState(0);", 
    "const [currentIndex, setCurrentIndex] = useState(_playerState.currentIndex ?? 0);");

    code = code.replace("const [isShuffle, setIsShuffle] = useState(true);", 
    "const [isShuffle, setIsShuffle] = useState(_playerState.isShuffle ?? true);");

    code = code.replace("const [isRepeat, setIsRepeat] = useState(false);", 
    "const [isRepeat, setIsRepeat] = useState(_playerState.isRepeat ?? false);");

    const syncCode = `
  // Sync state to/from global store for export/import
  useEffect(() => {
    const s = state.uiState?.musicPlayer;
    if (s) {
      if (s.currentIndex !== undefined && s.currentIndex !== currentIndex) setCurrentIndex(s.currentIndex);
      if (s.isShuffle !== undefined && s.isShuffle !== isShuffle) setIsShuffle(s.isShuffle);
      if (s.isRepeat !== undefined && s.isRepeat !== isRepeat) setIsRepeat(s.isRepeat);
    }
  }, [state.uiState?.musicPlayer]);

  useEffect(() => {
    updateUiState({
      musicPlayer: {
        ...(state.uiState?.musicPlayer || {}),
        currentIndex,
        isShuffle,
        isRepeat
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isShuffle, isRepeat]);
`;

    code = code.replace("const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);\n", 
    "const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);\n" + syncCode);

    fs.writeFileSync('src/components/MusicPlayerMode.tsx', code);
}
