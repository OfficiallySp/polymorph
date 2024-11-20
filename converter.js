class Polymorph {
    constructor() {
        this.inputFile = document.getElementById('inputFile');
        this.fileName = document.getElementById('fileName');
        this.outputFormat = document.getElementById('outputFormat');
        this.convertBtn = document.getElementById('convertBtn');
        this.status = document.getElementById('status');
        this.loadingMessage = document.getElementById('loadingLibraries');
        
        this.engineLoaded = false;
        
        this.supportedConversions = {
            'image/jpeg': ['image/png', 'image/webp', 'image/gif'],
            'image/png': ['image/jpeg', 'image/webp', 'image/gif'],
            'image/webp': ['image/jpeg', 'image/png', 'image/gif'],
            'image/gif': ['image/jpeg', 'image/png', 'image/webp'],
            'application/pdf': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['application/pdf', 'text/plain'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['text/csv', 'application/json'],
            'text/csv': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'],
            'text/plain': ['text/html', 'text/markdown', 'application/json'],
            'text/markdown': ['text/html', 'text/plain'],
            'text/html': ['text/plain', 'text/markdown'],
            'audio/mpeg': ['audio/wav', 'audio/ogg'],
            'audio/wav': ['audio/mpeg', 'audio/ogg'],
            'audio/ogg': ['audio/mpeg', 'audio/wav']
        };

        this.outputFormat.removeEventListener('change', this.handleFormatChange);
        this.outputFormat.addEventListener('change', this.handleFormatChange.bind(this));

        this.initializeEventListeners();
        this.loadLibraries().then(() => {
            this.engineLoaded = true;
            this.loadingMessage.textContent = 'All engines loaded! Ready to transform files.';
            setTimeout(() => {
                this.loadingMessage.style.display = 'none';
            }, 1000);
        }).catch(error => {
            this.loadingMessage.textContent = 'Error loading libraries. Please refresh the page.';
            console.error('Error loading libraries:', error);
        });
    }

    initializeEventListeners() {
        this.inputFile.addEventListener('change', (e) => this.handleFileSelect(e));
        this.convertBtn.addEventListener('click', () => this.convertFile());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.fileName.textContent = file.name;
        const mimeType = this.getMimeType(file);
        
        if (!this.supportedConversions[mimeType]) {
            this.status.textContent = `Unsupported file type: ${mimeType}`;
            this.outputFormat.disabled = true;
            this.convertBtn.disabled = true;
            return;
        }

        this.updateOutputFormats(mimeType);
        this.outputFormat.disabled = false;
        this.status.textContent = '';
    }

    handleFormatChange() {
        this.convertBtn.disabled = !this.outputFormat.value;
    }

    updateOutputFormats(inputType) {
        this.outputFormat.innerHTML = '<option value="">Select output format...</option>';
        
        if (this.supportedConversions[inputType]) {
            this.supportedConversions[inputType].forEach(format => {
                const option = document.createElement('option');
                option.value = format;
                option.textContent = format.split('/')[1].toUpperCase();
                this.outputFormat.appendChild(option);
            });
        }
    }

    async convertFile() {
        if (!this.engineLoaded) {
            this.status.textContent = 'Please wait for engines to load...';
            return;
        }

        const file = this.inputFile.files[0];
        const outputFormat = this.outputFormat.value;

        if (!file || !outputFormat) {
            this.status.textContent = 'Please select both input file and output format';
            return;
        }

        this.status.textContent = 'Converting...';
        this.convertBtn.disabled = true;
        
        try {
            const result = await this.performConversion(file, outputFormat);
            this.downloadResult(result, outputFormat);
            this.status.textContent = 'Conversion complete!';
        } catch (error) {
            console.error('Conversion error:', error);
            this.status.textContent = `Error: ${error.message}`;
        } finally {
            this.convertBtn.disabled = false;
        }
    }

    async loadLibraries() {
        try {
            this.loadingMessage.textContent = 'Loading PDF engine...';
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js');
            
            this.loadingMessage.textContent = 'Loading document engine...';
            await this.loadScript('https://unpkg.com/docx@7.1.0/build/index.js');
            
            this.loadingMessage.textContent = 'Loading spreadsheet engine...';
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js');
            
            this.loadingMessage.textContent = 'Loading audio engine...';
            await this.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.10.1/dist/ffmpeg.min.js');
            
            this.loadingMessage.textContent = 'All engines loaded!';
            setTimeout(() => {
                this.loadingMessage.style.display = 'none';
            }, 1000);
        } catch (error) {
            throw new Error('Failed to load conversion engines: ' + error.message);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`Loaded: ${src}`);
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    async performConversion(file, outputFormat) {
        const inputType = file.type;

        if (inputType.startsWith('image/')) {
            return await this.convertImage(file, outputFormat);
        } else if (inputType === 'application/pdf' || inputType.includes('word')) {
            return await this.convertDocument(file, outputFormat);
        } else if (inputType.includes('sheet') || inputType === 'text/csv') {
            return await this.convertSpreadsheet(file, outputFormat);
        } else if (inputType.startsWith('audio/')) {
            return await this.convertAudio(file, outputFormat);
        } else if (inputType.startsWith('text/')) {
            return await this.convertText(file, outputFormat);
        }
        
        throw new Error('Conversion not supported');
    }

    async convertDocument(file, outputFormat) {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let text = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(' ') + '\n';
            }

            return new Blob([text], { type: outputFormat });
        } else {
            const arrayBuffer = await file.arrayBuffer();
            const doc = new docx.Document(arrayBuffer);
            const text = await doc.getText();
            
            return new Blob([text], { type: outputFormat });
        }
    }

    async convertSpreadsheet(file, outputFormat) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (outputFormat === 'text/csv') {
            const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
            return new Blob([csvContent], { type: 'text/csv' });
        } else if (outputFormat === 'application/json') {
            const jsonContent = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            return new Blob([JSON.stringify(jsonContent)], { type: 'application/json' });
        }
    }

    async convertAudio(file, outputFormat) {
        const ffmpeg = createFFmpeg({ log: true });
        await ffmpeg.load();

        const inputFormat = file.type.split('/')[1];
        const outputExt = outputFormat.split('/')[1];
        
        ffmpeg.FS('writeFile', `input.${inputFormat}`, await file.arrayBuffer());
        await ffmpeg.run('-i', `input.${inputFormat}`, `output.${outputExt}`);
        
        const data = ffmpeg.FS('readFile', `output.${outputExt}`);
        return new Blob([data.buffer], { type: outputFormat });
    }

    async convertText(file, outputFormat) {
        const text = await file.text();
        
        if (outputFormat === 'text/html') {
            const html = marked(text);
            return new Blob([html], { type: 'text/html' });
        } else if (outputFormat === 'text/markdown') {
            const turndown = new TurndownService();
            const markdown = turndown.turndown(text);
            return new Blob([markdown], { type: 'text/markdown' });
        }
        
        return new Blob([text], { type: outputFormat });
    }

    async convertImage(file, outputFormat) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(resolve, outputFormat);
            };

            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    downloadResult(blob, outputFormat) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `converted.${outputFormat.split('/')[1]}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getMimeType(file) {
        // Common file extensions to MIME types mapping
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'csv': 'text/csv',
            'txt': 'text/plain',
            'html': 'text/html',
            'md': 'text/markdown',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg'
        };

        const extension = file.name.split('.').pop().toLowerCase();
        return file.type || mimeTypes[extension] || 'application/octet-stream';
    }
}

// Initialize the application
new Polymorph(); 