window.XLSXLoader = (function() {
  function parseXLSX(arrayBuffer, sheetName = null) {
    return new Promise((resolve, reject) => {
      try {
        if (!window.XLSX) throw new Error('SheetJS library not loaded');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Use specified sheet or first sheet
        const targetSheet = sheetName || workbook.SheetNames[0];
        if (!workbook.Sheets[targetSheet]) {
          throw new Error(`Sheet "${targetSheet}" not found. Available: ${workbook.SheetNames.join(', ')}`);
        }
        
        const worksheet = workbook.Sheets[targetSheet];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(data);
      } catch (err) {
        reject(err);
      }
    });
  }

  async function fetchXLSX(path, sheetName = null) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load ' + path);
    const arrayBuffer = await res.arrayBuffer();
    return parseXLSX(arrayBuffer, sheetName);
  }

  return { parseXLSX, fetchXLSX };
})();
