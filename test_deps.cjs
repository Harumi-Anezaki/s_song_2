const fs = require('fs');
const code = fs.readFileSync('src/components/OriginalDb.tsx', 'utf-8');
const deps = code.match(/useMemo\(\(\) => getComputedSongs\(\), \[(.*?)\]\)/);
console.log(deps ? deps[1] : 'not found');
