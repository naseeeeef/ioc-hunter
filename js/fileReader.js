/**
 * fileReader.js
 * Handles reading .txt, .csv, and .xlsx files into raw text strings.
 * Uses the globally loaded SheetJS (XLSX) for Excel files.
 * All processing is local — nothing is sent to any server.
 */

export class FileProcessor {
    /**
     * Read a File object and resolve with its full text content.
     * @param {File} file
     * @returns {Promise<string>}
     */
    static readAsText(file) {
        return new Promise((resolve, reject) => {
            const ext = file.name.split('.').pop().toLowerCase();
            const reader = new FileReader();

            if (ext === 'xlsx' || ext === 'xls') {
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        // eslint-disable-next-line no-undef
                        const wb = XLSX.read(data, { type: 'array' });
                        let text = '';
                        wb.SheetNames.forEach(name => {
                            // eslint-disable-next-line no-undef
                            text += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n';
                        });
                        resolve(text);
                    } catch (err) {
                        reject(new Error('Excel parse failed: ' + err.message));
                    }
                };
                reader.onerror = () => reject(new Error('FileReader error'));
                reader.readAsArrayBuffer(file);
            } else {
                reader.onload = (e) => resolve(e.target.result || '');
                reader.onerror = () => reject(new Error('FileReader error'));
                reader.readAsText(file);
            }
        });
    }
}
