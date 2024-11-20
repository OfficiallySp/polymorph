class Polymorph {
    constructor() {
        this.inputFile = document.getElementById('inputFile');
        this.fileName = document.getElementById('fileName');
        this.outputFormat = document.getElementById('outputFormat');
        this.convertBtn = document.getElementById('convertBtn');
        this.status = document.getElementById('status');
        
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

        this.initializeEventListeners();
        this.loadLibraries();
    }

    initializeEventListeners() {
        this.inputFile.addEventListener('change', (e) => this.handleFileSelect(e));
        this.convertBtn.addEventListener('click', () => this.convertFile());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.fileName.textContent = file.name;
        this.updateOutputFormats(file.type);
        this.outputFormat.disabled = false;
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

        this.outputFormat.addEventListener('change', () => {
            this.convertBtn.disabled = !this.outputFormat.value;
        });
    }

    async convertFile() {
        const file = this.inputFile.files[0];
        const outputFormat = this.outputFormat.value;

        if (!file || !outputFormat) return;

        this.status.textContent = 'Converting...';
        
        try {
            const result = await this.performConversion(file, outputFormat);
            this.downloadResult(result, outputFormat);
            this.status.textContent = 'Conversion complete!';
        } catch (error) {
            this.status.textContent = `Error: ${error.message}`;
        }
    }

    async loadLibraries() {
        await Promise.all([
            this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js'),
            this.loadScript('https://unpkg.com/docx@7.1.0/build/index.js'),
            this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js'),
            this.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.10.1/dist/ffmpeg.min.js')
        ]);
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
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
}

// Initialize the application
new Polymorph(); 