/**
 * Main entry point for the Juzgado Documentation System
 * 
 * This file initializes the application and sets up all the
 * necessary components and event listeners for the complete
 * "CREAR SUMARIO" workflow.
 * 
 * @version 1.0.0
 */

// Import core modules
import { FileUpload } from './components/FileUpload.js';
import { PDFViewer } from './components/PDFViewer.js';
import { ProcessingQueue } from './components/ProcessingQueue.js';
import { ResultsPanel } from './components/ResultsPanel.js';
import { DocumentManager } from './components/DocumentManager.js';
import { FileOrganizer } from './components/FileOrganizer.js';
import { AIDescriptionManager, aiDescriptionManager } from './components/AIDescriptionManager.js';
import { PDFMerger } from './components/PDFMerger.js';
import { IndexGenerator } from './components/IndexGenerator.js';
import { PDFProcessor } from './core/pdfProcessor.js';
import { OCRValidator } from './core/ocrValidator.js';
import { AuditLogger } from './utils/auditLogger.js';
import { Toast } from './utils/toast.js';
import { EventBus } from './utils/eventBus.js';

// Import styles
import './assets/styles/main.css';

/**
 * Main Application Class
 * 
 * Manages the entire application lifecycle and coordinates
 * between different components for the complete workflow.
 */
class App {
  constructor() {
    // Application state
    this.state = {
      files: [],
      processing: false,
      processedFiles: [],
      excludedFiles: [],
      organizedFiles: [],
      settings: {
        validateOCR: true,
        mergePDFs: false,
        generateAIDescription: false,
        generateIndex: false,
        descriptionMode: 'none',
        sortOrder: 'name',
        sortDirection: 'asc'
      },
      workflow: {
        currentStep: 0,
        totalSteps: 6,
        steps: [
          'Subir archivos',
          'Organizar documentos',
          'Generar descripciones',
          'Configurar índice',
          'Procesar documentos',
          'Generar sumario final'
        ]
      }
    };

    // Initialize components
    this.initializeComponents();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Log application start
    AuditLogger.info('Application initialized', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Initialize all application components
   */
  initializeComponents() {
    // Initialize UI components
    this.fileUpload = new FileUpload({
      container: document.getElementById('file-upload-area'),
      input: document.getElementById('file-input'),
      onFilesSelected: this.handleFilesSelected.bind(this),
    });

    this.pdfViewer = new PDFViewer({
      container: document.getElementById('pdf-viewer-content'),
      titleElement: document.getElementById('pdf-viewer-title'),
    });

    this.processingQueue = new ProcessingQueue({
      container: document.getElementById('processing-status'),
      progressBar: document.getElementById('progress-bar'),
      percentageElement: document.getElementById('progress-percentage'),
      taskElement: document.getElementById('current-task'),
      stepsElement: document.getElementById('processing-steps'),
    });

    this.resultsPanel = new ResultsPanel({
      container: document.getElementById('results'),
      processedContainer: document.getElementById('processed-files-list'),
      excludedContainer: document.getElementById('excluded-files-list'),
      downloadsContainer: document.getElementById('download-list'),
    });

    // Initialize core processing modules
    this.pdfProcessor = new PDFProcessor();
    this.ocrValidator = new OCRValidator();
    this.pdfMerger = new PDFMerger();
    this.indexGeneratorComponent = new IndexGenerator();

    // Initialize manager components
    this.fileOrganizer = new FileOrganizer('file-organizer', []);
    this.aiDescriptionManager = aiDescriptionManager;

    // Initialize utility modules
    this.eventBus = EventBus;
  }

  /**
   * Set up event listeners for the application
   */
  setupEventListeners() {
    // CREAR SUMARIO button
    const crearSumarioBtn = document.getElementById('crear-sumario-btn');
    if (crearSumarioBtn) {
      crearSumarioBtn.addEventListener('click', () => this.handleCrearSumario());
    }

    // File upload events
    document.getElementById('clear-files')?.addEventListener('click', () => {
      this.clearAllFiles();
    });

    // Sort controls
    document.getElementById('sort-order')?.addEventListener('change', (e) => {
      this.state.settings.sortOrder = e.target.value;
      this.updateFileOrganization();
    });

    document.getElementById('sort-direction')?.addEventListener('change', (e) => {
      this.state.settings.sortDirection = e.target.value;
      this.updateFileOrganization();
    });

    // Description mode events
    document.querySelectorAll('input[name="description-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.state.settings.descriptionMode = e.target.value;
        this.state.settings.generateAIDescription = e.target.value === 'ai';
        
        // Show/hide AI options
        const aiOptions = document.getElementById('ai-description-options');
        if (aiOptions) {
          aiOptions.classList.toggle('hidden', e.target.value !== 'ai');
        }
      });
    });

    // AI description options
    document.getElementById('ai-style')?.addEventListener('change', (e) => {
      this.aiDescriptionManager.updateConfig({ style: e.target.value });
    });

    document.getElementById('ai-max-length')?.addEventListener('change', (e) => {
      this.aiDescriptionManager.updateConfig({ maxLength: parseInt(e.target.value) });
    });

    // Index configuration events
    document.getElementById('generate-index')?.addEventListener('change', (e) => {
      this.state.settings.generateIndex = e.target.checked;
      
      // Show/hide index format options
      const indexOptions = document.getElementById('index-format-options');
      if (indexOptions) {
        indexOptions.classList.toggle('hidden', !e.target.checked);
      }
    });

    document.getElementById('merge-pdfs')?.addEventListener('change', (e) => {
      this.state.settings.mergePDFs = e.target.checked;
    });

    // Results tab events
    document.querySelectorAll('.results-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchResultsTab(e.target.dataset.tab);
      });
    });

    // PDF viewer modal events
    document.getElementById('close-pdf-viewer')?.addEventListener('click', () => {
      this.closePDFViewer();
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePDFViewer();
      }
    });

    // Mobile menu toggle
    const mobileMenuButton = document.querySelector('[aria-controls="mobile-menu"]');
    const mobileMenu = document.getElementById('mobile-menu');
    
    mobileMenuButton?.addEventListener('click', () => {
      const expanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
      mobileMenuButton.setAttribute('aria-expanded', !expanded);
      mobileMenu?.classList.toggle('hidden');
    });

    // Navigation smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      });
    });

    // Listen for custom events
    this.eventBus
      .on('file:preview', this.handleFilePreview.bind(this))
      .on('processing:complete', this.handleProcessingComplete.bind(this))
      .on('processing:error', this.handleProcessingError.bind(this))
      .on('toast:show', this.showToast.bind(this))
      .on('files:organized', this.handleFilesOrganized.bind(this))
      .on('descriptions:generated', this.handleDescriptionsGenerated.bind(this))
      .on('merge:completed', this.handleMergeCompleted.bind(this))
      .on('index:generated', this.handleIndexGenerated.bind(this));
  }

  /**
   * Handle files selected from file upload
   */
  handleFilesSelected(files) {
    // Add files to state
    this.state.files = [...this.state.files, ...files];
    
    // Update UI
    this.updateFileList();
    this.showSectionsAfterUpload();
    
    // Enable CREAR SUMARIO button
    const crearSumarioBtn = document.getElementById('crear-sumario-btn');
    if (crearSumarioBtn) {
      crearSumarioBtn.disabled = false;
      document.querySelector('#crear-sumario-btn + p').classList.add('hidden');
    }
    
    Toast.success(`${files.length} archivo(s) agregado(s) exitosamente`);
    
    AuditLogger.info('Files selected', {
      count: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      fileNames: files.map(f => f.name),
    });
  }

  /**
   * Show sections after files are uploaded
   */
  showSectionsAfterUpload() {
    // Show organization section
    const orgSection = document.getElementById('organization');
    if (orgSection) {
      orgSection.classList.remove('hidden');
    }

    // Show description section
    const descSection = document.getElementById('description');
    if (descSection) {
      descSection.classList.remove('hidden');
    }

    // Show index section
    const indexSection = document.getElementById('index');
    if (indexSection) {
      indexSection.classList.remove('hidden');
    }

    // Initialize file organizer with uploaded files
    this.fileOrganizer.updateFiles(this.state.files);
  }

  /**
   * Update file organization based on settings
   */
  updateFileOrganization() {
    if (this.state.files.length === 0) return;

    // Sort files based on settings
    const sortedFiles = [...this.state.files];
    const { sortOrder, sortDirection } = this.state.settings;

    switch (sortOrder) {
      case 'name':
        sortedFiles.sort((a, b) => {
          const result = a.name.localeCompare(b.name);
          return sortDirection === 'asc' ? result : -result;
        });
        break;
      case 'date':
        sortedFiles.sort((a, b) => {
          const result = (a.lastModified || 0) - (b.lastModified || 0);
          return sortDirection === 'asc' ? result : -result;
        });
        break;
      case 'size':
        sortedFiles.sort((a, b) => {
          const result = a.size - b.size;
          return sortDirection === 'asc' ? result : -result;
        });
        break;
      case 'custom':
        // Keep custom order from file organizer
        break;
    }

    this.state.organizedFiles = sortedFiles;
    
    // Update file organizer
    this.fileOrganizer.updateFiles(sortedFiles);
  }

  /**
   * Handle CREAR SUMARIO button click
   */
  async handleCrearSumario() {
    if (this.state.files.length === 0) {
      Toast.error('Por favor sube al menos un archivo PDF');
      return;
    }

    if (this.state.processing) {
      Toast.warning('Ya se está procesando un sumario');
      return;
    }

    try {
      // Start processing
      this.state.processing = true;
      this.state.workflow.currentStep = 0;

      // Show processing status
      const processingSection = document.getElementById('processing-status');
      if (processingSection) {
        processingSection.classList.remove('hidden');
        processingSection.scrollIntoView({ behavior: 'smooth' });
      }

      // Initialize processing queue
      this.processingQueue.start(this.state.workflow.totalSteps);

      // Execute workflow steps
      await this.executeWorkflow();

    } catch (error) {
      console.error('Workflow error:', error);
      Toast.error('Error en el procesamiento: ' + error.message);
      
      AuditLogger.error('Workflow failed', {
        error: error.message,
        stack: error.stack,
      });
      
    } finally {
      this.state.processing = false;
      this.processingQueue.complete();
    }
  }

  /**
   * Execute the complete workflow
   */
  async executeWorkflow() {
    AuditLogger.info('Starting CREAR SUMARIO workflow', {
      fileCount: this.state.files.length,
      settings: this.state.settings
    });

    // Step 1: Validate and prepare files
    await this.processStep(1, 'Validando archivos...', async () => {
      await this.validateAndPrepareFiles();
    });

    // Step 2: Organize files
    await this.processStep(2, 'Organizando documentos...', async () => {
      await this.organizeDocuments();
    });

    // Step 3: Generate descriptions
    if (this.state.settings.generateAIDescription || this.state.settings.descriptionMode !== 'none') {
      await this.processStep(3, 'Generando descripciones...', async () => {
        await this.generateDescriptions();
      });
    }

    // Step 4: Process documents (OCR, text extraction)
    await this.processStep(4, 'Procesando documentos...', async () => {
      await this.processDocuments();
    });

    // Step 5: Generate index
    if (this.state.settings.generateIndex) {
      await this.processStep(5, 'Generando índice...', async () => {
        await this.generateIndex();
      });
    }

    // Step 6: Merge PDFs and create final sumario
    if (this.state.settings.mergePDFs || this.state.settings.generateIndex) {
      await this.processStep(6, 'Creando sumario final...', async () => {
        await this.createFinalSumario();
      });
    }

    // Show results
    this.displayResults();

    Toast.success('¡Sumario creado exitosamente!');
    
    AuditLogger.success('CREAR SUMARIO workflow completed', {
      processedFiles: this.state.processedFiles.length,
      excludedFiles: this.state.excludedFiles.length,
      settings: this.state.settings
    });
  }

  /**
   * Process a single workflow step
   */
  async processStep(stepNumber, description, taskFunction) {
    this.state.workflow.currentStep = stepNumber;
    
    // Update progress
    const progress = (stepNumber / this.state.workflow.totalSteps) * 100;
    this.processingQueue.updateProgress(progress, description);

    // Add step to processing steps list
    this.addProcessingStep(stepNumber, description, 'active');

    try {
      await taskFunction();
      
      // Mark step as completed
      this.updateProcessingStep(stepNumber, 'completed');
      
      AuditLogger.info(`Workflow step ${stepNumber} completed`, { description });
      
    } catch (error) {
      // Mark step as failed
      this.updateProcessingStep(stepNumber, 'failed');
      
      AuditLogger.error(`Workflow step ${stepNumber} failed`, {
        description,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Add processing step to UI
   */
  addProcessingStep(stepNumber, description, status = 'pending') {
    const stepsContainer = document.getElementById('processing-steps');
    if (!stepsContainer) return;

    const stepId = `step-${stepNumber}`;
    let stepElement = document.getElementById(stepId);
    
    if (!stepElement) {
      stepElement = document.createElement('div');
      stepElement.id = stepId;
      stepElement.className = 'processing-step';
      stepsContainer.appendChild(stepElement);
    }

    stepElement.className = `processing-step ${status}`;
    stepElement.innerHTML = `
      <div class="processing-step-icon ${status}">
        ${this.getStepIcon(status)}
      </div>
      <div class="processing-step-text">${description}</div>
    `;
  }

  /**
   * Update processing step status
   */
  updateProcessingStep(stepNumber, status) {
    const stepElement = document.getElementById(`step-${stepNumber}`);
    if (!stepElement) return;

    stepElement.className = `processing-step ${status}`;
    
    const icon = stepElement.querySelector('.processing-step-icon');
    if (icon) {
      icon.className = `processing-step-icon ${status}`;
      icon.innerHTML = this.getStepIcon(status);
    }
  }

  /**
   * Get icon for step status
   */
  getStepIcon(status) {
    switch (status) {
      case 'completed':
        return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
      case 'active':
        return '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';
      case 'failed':
        return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
      default:
        return '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }
  }

  /**
   * Validate and prepare files for processing
   */
  async validateAndPrepareFiles() {
    const validFiles = [];
    const excludedFiles = [];

    for (const file of this.state.files) {
      try {
        // Check if file is PDF
        if (file.type !== 'application/pdf') {
          excludedFiles.push({
            file,
            reason: 'No es un archivo PDF'
          });
          continue;
        }

        // Check file size (limit: 50MB)
        if (file.size > 50 * 1024 * 1024) {
          excludedFiles.push({
            file,
            reason: 'Archivo demasiado grande (máximo 50MB)'
          });
          continue;
        }

        // Validate OCR if enabled
        if (this.state.settings.validateOCR) {
          const hasOCR = await this.ocrValidator.validate(file);
          if (!hasOCR) {
            excludedFiles.push({
              file,
              reason: 'No se encontró texto searchable'
            });
            continue;
          }
        }

        // Add to valid files
        validFiles.push({
          ...file,
          id: this.generateFileId(),
          status: 'pending'
        });

      } catch (error) {
        excludedFiles.push({
          file,
          reason: `Error de validación: ${error.message}`
        });
      }
    }

    this.state.validatedFiles = validFiles;
    this.state.excludedFiles = excludedFiles;

    AuditLogger.info('Files validated', {
      validCount: validFiles.length,
      excludedCount: excludedFiles.length
    });
  }

  /**
   * Organize documents based on user preferences
   */
  async organizeDocuments() {
    // Apply sorting
    this.updateFileOrganization();
    
    // Get organized files from file organizer
    const organizedFiles = this.fileOrganizer.getFileOrder().map(id => 
      this.state.validatedFiles.find(f => f.id === id)
    ).filter(Boolean);

    this.state.organizedFiles = organizedFiles;

    AuditLogger.info('Documents organized', {
      criteria: this.state.settings.sortOrder,
      direction: this.state.settings.sortDirection,
      fileCount: organizedFiles.length
    });
  }

  /**
   * Generate descriptions for documents
   */
  async generateDescriptions() {
    const { descriptionMode } = this.state.settings;
    
    if (descriptionMode === 'none') return;

    // Update AI description manager with files
    this.aiDescriptionManager.addFiles(this.state.organizedFiles);

    // Generate descriptions based on mode
    const result = await this.aiDescriptionManager.generateDescriptions(
      this.state.organizedFiles,
      descriptionMode
    );

    // Update files with descriptions
    result.descriptions && Object.entries(result.descriptions).forEach(([fileId, description]) => {
      const file = this.state.organizedFiles.find(f => f.id === fileId);
      if (file) {
        file.description = description;
        file.descriptionMode = descriptionMode;
      }
    });

    AuditLogger.info('Descriptions generated', {
      mode: descriptionMode,
      fileCount: this.state.organizedFiles.length
    });
  }

  /**
   * Process documents (extract text, etc.)
   */
  async processDocuments() {
    const processedFiles = [];

    for (let i = 0; i < this.state.organizedFiles.length; i++) {
      const file = this.state.organizedFiles[i];
      
      try {
        // Extract text content
        const textContent = await this.pdfProcessor.extractText(file);
        
        // Get page count
        const pageCount = await this.pdfProcessor.getPageCount(file);
        
        // Add to processed files
        processedFiles.push({
          ...file,
          textContent,
          pageCount,
          processedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        
        // Add to excluded files
        this.state.excludedFiles.push({
          file,
          reason: `Error de procesamiento: ${error.message}`
        });
      }
    }

    this.state.processedFiles = processedFiles;

    AuditLogger.info('Documents processed', {
      processedCount: processedFiles.length,
      excludedCount: this.state.excludedFiles.length
    });
  }

  /**
   * Generate index for documents
   */
  async generateIndex() {
    const indexData = {
      title: 'Índice de Documentos',
      generatedAt: new Date().toISOString(),
      entries: this.state.processedFiles.map((file, index) => ({
        id: file.id,
        fileName: file.name,
        description: file.description || file.name,
        startPage: 1, // Will be updated after merging
        pageCount: file.pageCount
      }))
    };

    // Generate index using index generator component
    const generatedIndex = await this.indexGeneratorComponent.generate(indexData);
    
    this.state.generatedIndex = generatedIndex;

    AuditLogger.info('Index generated', {
      entryCount: indexData.entries.length
    });
  }

  /**
   * Create final sumario (merge PDFs if needed)
   */
  async createFinalSumario() {
    const downloads = [];

    // If merging is enabled
    if (this.state.settings.mergePDFs && this.state.processedFiles.length > 1) {
      try {
        // Merge PDFs
        const mergedPDF = await this.pdfMerger.mergePDFs(
          this.state.processedFiles.map(f => f.file),
          {
            generateTOC: this.state.settings.generateIndex,
            addBookmarks: true,
            maintainPageNumbering: true
          }
        );

        // Create download
        const mergedBlob = new Blob([mergedPDF], { type: 'application/pdf' });
        downloads.push({
          name: 'sumario_completo.pdf',
          blob: mergedBlob,
          description: 'Todos los documentos unidos en un solo PDF'
        });

        AuditLogger.info('PDFs merged successfully');

      } catch (error) {
        console.error('Error merging PDFs:', error);
        Toast.error('Error al unir los PDFs');
      }
    }

    // Add individual processed files
    this.state.processedFiles.forEach(file => {
      downloads.push({
        name: file.name,
        blob: file.file,
        description: file.description || 'Documento individual'
      });
    });

    // Add generated index if available
    if (this.state.generatedIndex) {
      const indexBlob = new Blob([this.state.generatedIndex.content], { 
        type: this.state.generatedIndex.contentType 
      });
      
      downloads.push({
        name: 'indice.pdf',
        blob: indexBlob,
        description: 'Índice de documentos'
      });
    }

    this.state.downloads = downloads;
  }

  /**
   * Display final results
   */
  displayResults() {
    // Show results section
    const resultsSection = document.getElementById('results');
    if (resultsSection) {
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Display results in results panel
    this.resultsPanel.displayResults({
      processed: this.state.processedFiles,
      excluded: this.state.excludedFiles,
      downloads: this.state.downloads || []
    });

    AuditLogger.info('Results displayed', {
      processedCount: this.state.processedFiles.length,
      excludedCount: this.state.excludedFiles.length,
      downloadCount: this.state.downloads?.length || 0
    });
  }

  /**
   * Update file list display
   */
  updateFileList() {
    const fileList = document.getElementById('file-list');
    const selectedFiles = document.getElementById('selected-files');
    
    if (this.state.files.length > 0 && fileList && selectedFiles) {
      fileList.classList.remove('hidden');
      
      selectedFiles.innerHTML = this.state.files.map((file, index) => `
        <li class="file-item" data-index="${index}">
          <div class="file-item-info">
            <svg class="file-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <div class="file-item-details">
              <div class="file-item-name">${file.name}</div>
              <div class="file-item-size">${this.formatFileSize(file.size)}</div>
            </div>
          </div>
          <div class="file-item-status">
            <button class="text-red-600 hover:text-red-700" onclick="app.removeFile(${index})">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </li>
      `).join('');
    } else if (fileList) {
      fileList.classList.add('hidden');
    }
  }

  /**
   * Remove a file from the list
   */
  removeFile(index) {
    const removedFile = this.state.files[index];
    this.state.files.splice(index, 1);
    this.updateFileList();
    
    // Hide sections if no files
    if (this.state.files.length === 0) {
      this.hideSections();
      
      // Disable CREAR SUMARIO button
      const crearSumarioBtn = document.getElementById('crear-sumario-btn');
      if (crearSumarioBtn) {
        crearSumarioBtn.disabled = true;
        document.querySelector('#crear-sumario-btn + p').classList.remove('hidden');
      }
    }
    
    Toast.info(`Eliminado: ${removedFile.name}`);
    
    AuditLogger.info('File removed', {
      fileName: removedFile.name,
      remainingFiles: this.state.files.length,
    });
  }

  /**
   * Hide sections when no files
   */
  hideSections() {
    const sections = ['organization', 'description', 'index'];
    sections.forEach(id => {
      const section = document.getElementById(id);
      if (section) {
        section.classList.add('hidden');
      }
    });
  }

  /**
   * Clear all files
   */
  clearAllFiles() {
    if (this.state.files.length === 0) return;
    
    if (confirm('¿Estás seguro de que quieres eliminar todos los archivos?')) {
      this.state.files = [];
      this.updateFileList();
      this.hideSections();
      
      // Disable CREAR SUMARIO button
      const crearSumarioBtn = document.getElementById('crear-sumario-btn');
      if (crearSumarioBtn) {
        crearSumarioBtn.disabled = true;
        document.querySelector('#crear-sumario-btn + p').classList.remove('hidden');
      }
      
      Toast.info('Todos los archivos han sido eliminados');
      
      AuditLogger.info('All files cleared');
    }
  }

  /**
   * Switch results tab
   */
  switchResultsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.results-tab').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active', 'border-blue-500', 'text-blue-600');
        tab.classList.remove('border-transparent', 'text-gray-500');
      } else {
        tab.classList.remove('active', 'border-blue-500', 'text-blue-600');
        tab.classList.add('border-transparent', 'text-gray-500');
      }
    });
    
    // Update tab content
    document.querySelectorAll('.results-tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
      activeTab.classList.remove('hidden');
    }
  }

  /**
   * Handle file preview request
   */
  handleFilePreview(file) {
    if (file.type === 'application/pdf') {
      this.pdfViewer.loadFile(file);
      document.getElementById('pdf-viewer-modal')?.classList.remove('hidden');
    } else {
      Toast.error('Vista previa solo disponible para archivos PDF');
    }
  }

  /**
   * Close PDF viewer modal
   */
  closePDFViewer() {
    document.getElementById('pdf-viewer-modal')?.classList.add('hidden');
    this.pdfViewer.clear();
  }

  /**
   * Event handlers for component events
   */
  handleFilesOrganized(data) {
    this.state.organizedFiles = data.files;
    AuditLogger.info('Files organized via drag and drop', data);
  }

  handleDescriptionsGenerated(data) {
    Toast.success(`${data.fileCount} descripciones generadas`);
    AuditLogger.info('Descriptions generated', data);
  }

  handleMergeCompleted(data) {
    Toast.success('PDFs unidos exitosamente');
    AuditLogger.info('PDF merge completed', data);
  }

  handleIndexGenerated(data) {
    Toast.success('Índice generado exitosamente');
    AuditLogger.info('Index generated', data);
  }

  handleProcessingComplete(data) {
    Toast.success('Procesamiento completado');
    AuditLogger.info('Processing completed', data);
  }

  handleProcessingError(error) {
    Toast.error('Error en el procesamiento: ' + error.message);
    AuditLogger.error('Processing error', { error });
  }

  showToast(message, type = 'info') {
    Toast.show(message, type);
  }

  /**
   * Utility methods
   */
  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Initialize application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // Create global app instance
  window.app = new App();
  
  // Log successful initialization
  console.log('Sistema de Documentación Judicial inicializado exitosamente');
  
  // Add global error handler
  window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    AuditLogger.error('Global error', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  });
  
  // Add unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Rechazo de promesa no manejado:', event.reason);
    AuditLogger.error('Unhandled promise rejection', {
      reason: event.reason,
    });
  });
});

// Export app instance for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}