class Polymorph {
    constructor() {
        this.inputFile = document.getElementById('inputFile');
        this.fileName = document.getElementById('fileName');
        this.outputFormat = document.getElementById('outputFormat');
        this.convertBtn = document.getElementById('convertBtn');
        this.status = document.getElementById('status');
        
        this.supportedConversions = {
            'image/jpeg': ['image/png', 'image/webp'],
            'image/png': ['image/jpeg', 'image/webp'],
            'image/webp': ['image/jpeg', 'image/png'],
            'text/plain': ['text/html', 'text/markdown'],
            // Add more conversion options as needed
        };

        this.initializeEventListeners();
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

    async performConversion(file, outputFormat) {
        // This is where you'll implement the actual conversion logic
        // For now, we'll just handle image conversions as an example
        if (file.type.startsWith('image/')) {
            return await this.convertImage(file, outputFormat);
        }
        
        throw new Error('Conversion not supported yet');
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