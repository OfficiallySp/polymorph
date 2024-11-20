class Polymorph {
    constructor() {
        this.inputFile = document.getElementById('inputFile');
        this.fileName = document.getElementById('fileName');
        this.formatButtons = document.getElementById('formatButtons');
        this.convertBtn = document.getElementById('convertBtn');
        this.status = document.getElementById('status');
        this.selectedFormat = null;
        this.loadingText = document.getElementById('loadingLibraries');
        this.converterBox = document.querySelector('.converter-box');
        
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

        this.allFormats = new Set();
        Object.values(this.supportedConversions).forEach(formats => {
            formats.forEach(format => this.allFormats.add(format));
        });
        Object.keys(this.supportedConversions).forEach(format => {
            this.allFormats.add(format);
        });

        this.initializeEventListeners();
        this.loadLibraries();
        this.createAllFormatButtons();
        this.initializeDragAndDrop();
    }

    initializeEventListeners() {
        this.inputFile.addEventListener('change', (e) => this.handleFileSelect(e));
        this.convertBtn.addEventListener('click', () => this.convertFile());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.fileName.textContent = file.name;
        this.updateAvailableFormats(file.type);
        this.convertBtn.disabled = true;
        this.selectedFormat = null;
    }

    updateAvailableFormats(inputType) {
        const availableFormats = this.supportedConversions[inputType] || [];
        const buttons = this.formatButtons.querySelectorAll('.format-button');
        
        // First, get initial positions of all buttons
        const initialPositions = Array.from(buttons).map(button => {
            const rect = button.getBoundingClientRect();
            return { button, rect };
        });

        // Mark buttons as available/unavailable without changing positions yet
        buttons.forEach(button => {
            const format = button.dataset.format;
            if (availableFormats.includes(format)) {
                button.classList.remove('unavailable');
                button.classList.add('available');
            } else {
                button.classList.remove('available');
                button.classList.add('unavailable');
            }
        });

        // Force a reflow to get new positions
        this.formatButtons.offsetHeight;

        // Animate all buttons
        initialPositions.forEach(({ button, rect }) => {
            const format = button.dataset.format;
            const newRect = button.getBoundingClientRect();
            
            if (availableFormats.includes(format)) {
                // Reset button to its initial position
                gsap.set(button, {
                    x: rect.left - newRect.left,
                    y: rect.top - newRect.top,
                    opacity: 1,
                    scale: 1,
                    rotation: 0
                });

                // Animate to new position
                gsap.to(button, {
                    x: 0,
                    y: 0,
                    scale: 1,
                    rotation: 0,
                    duration: 0.8,
                    ease: "elastic.out(1, 0.7)",
                    clearProps: "all"
                });
            } else {
                // Fly away animation
                gsap.to(button, {
                    opacity: 0,
                    scale: 0.5,
                    rotation: (Math.random() - 0.5) * 180,
                    x: (Math.random() - 0.5) * 400,
                    y: (Math.random() - 0.5) * 400,
                    duration: 0.8,
                    ease: "power2.inOut",
                    onComplete: () => {
                        button.style.visibility = 'hidden';
                        button.style.position = 'absolute';
                    }
                });
            }
        });
    }

    async convertFile() {
        const file = this.inputFile.files[0];
        const outputFormat = this.selectedFormat;

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
        try {
            await Promise.all([
                this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js'),
                this.loadScript('https://unpkg.com/docx@7.1.0/build/index.js'),
                this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js'),
                this.loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.10.1/dist/ffmpeg.min.js')
            ]);
            
            // Fade out and remove the loading text
            gsap.to(this.loadingText, {
                opacity: 0,
                duration: 0.5,
                onComplete: () => {
                    this.loadingText.style.display = 'none';
                }
            });
        } catch (error) {
            this.loadingText.textContent = 'Error loading some conversion engines. Some features may be limited.';
            console.error('Error loading libraries:', error);
        }
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

    createAllFormatButtons() {
        this.formatButtons.innerHTML = '';
        
        const wrapper = document.createElement('div');
        
        Array.from(this.allFormats).sort().forEach(format => {
            const button = this.createFormatButton(format);
            wrapper.appendChild(button);
        });
        
        this.formatButtons.appendChild(wrapper);

        // Improved initial animation
        gsap.from('.format-button', {
            opacity: 0,
            scale: 0,
            duration: 0.5,
            stagger: {
                amount: 1,
                from: "random",
                grid: "auto"
            },
            ease: "elastic.out(1, 0.7)",
            clearProps: "transform"
        });
    }

    createFormatButton(format) {
        const button = document.createElement('button');
        button.className = 'format-button';
        button.textContent = format.split('/')[1].toUpperCase();
        button.dataset.format = format;
        
        button.addEventListener('click', () => {
            if (!button.classList.contains('unavailable')) {
                this.formatButtons.querySelectorAll('.format-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
                button.classList.add('selected');
                this.selectedFormat = format;
                this.convertBtn.disabled = false;
            }
        });
        
        return button;
    }

    initializeDragAndDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.converterBox.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.converterBox.addEventListener(eventName, () => {
                this.converterBox.classList.add('drag-over');
                gsap.to('.drag-icon', {
                    scale: 1.2,
                    duration: 0.3,
                    ease: 'back.out'
                });
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.converterBox.addEventListener(eventName, () => {
                this.converterBox.classList.remove('drag-over');
                gsap.to('.drag-icon', {
                    scale: 1,
                    duration: 0.3,
                    ease: 'back.out'
                });
            });
        });

        this.converterBox.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (file) {
                this.inputFile.files = e.dataTransfer.files;
                this.handleFileSelect({ target: { files: [file] } });
                
                // Add drop animation
                const dropPoint = {
                    x: e.clientX,
                    y: e.clientY
                };
                
                this.createDropAnimation(dropPoint);
            }
        });
    }

    createDropAnimation(point) {
        // Create ripple effect
        const ripple = document.createElement('div');
        ripple.className = 'drop-ripple';
        document.body.appendChild(ripple);
        
        const rect = this.converterBox.getBoundingClientRect();
        const x = point.x - rect.left;
        const y = point.y - rect.top;
        
        gsap.set(ripple, {
            x: point.x,
            y: point.y,
            scale: 0,
            opacity: 1
        });
        
        gsap.to(ripple, {
            scale: 1,
            opacity: 0,
            duration: 0.6,
            ease: 'power2.out',
            onComplete: () => ripple.remove()
        });

        // Animate converter box
        gsap.to(this.converterBox, {
            scale: 1.05,
            duration: 0.15,
            ease: 'power2.out',
            yoyo: true,
            repeat: 1
        });
    }
}

// Initialize the application
new Polymorph(); 