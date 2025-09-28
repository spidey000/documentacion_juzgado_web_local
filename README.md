# Client-Side PDF Document Processor

A 100% browser-based PDF document processing solution with complete transparency and auditability.

## Overview

This application provides comprehensive PDF processing capabilities entirely in the browser, with no backend dependencies. It includes OCR validation, PDF merging, AI-powered description generation, and index creation features.

## Key Features

- **PDF OCR Validation**: Verify uploaded PDFs contain searchable/extractable text
- **PDF Merging**: Combine multiple PDFs with automatic page numbering
- **AI-Powered Descriptions**: Generate document summaries using Transformers.js
- **Index Generation**: Create searchable indexes in PDF and Word formats
- **File Management**: Upload, organize, and track document processing
- **Exclusion Reporting**: Identify and report documents that couldn't be processed

## Technology Stack

- **Core Libraries**:
  - `pdf-lib`: PDF manipulation and merging
  - `pdf.js`: PDF rendering and text extraction
  - `docx`: Word document generation
  - `transformers.js`: AI-powered text processing
  - `file-saver`: Client-side file downloads

- **UI Framework**:
  - TailwindCSS for styling
  - Vanilla JavaScript for maximum transparency

- **Build Tools**:
  - Vite for development and building
  - ESLint for code quality
  - Prettier for code formatting

## Project Structure

```
client-side-pdf-processor/
├── src/
│   ├── components/          # UI components
│   │   ├── FileUpload.js
│   │   ├── PDFViewer.js
│   │   ├── ProcessingQueue.js
│   │   └── ResultsPanel.js
│   ├── core/               # Core processing logic
│   │   ├── pdfProcessor.js
│   │   ├── ocrEngine.js
│   │   ├── aiDescriber.js
│   │   └── indexGenerator.js
│   ├── utils/              # Utility functions
│   │   ├── fileHandlers.js
│   │   ├── validators.js
│   │   ├── formatters.js
│   │   └── auditLogger.js
│   ├── assets/             # Static assets
│   │   └── styles/
│   │       └── main.css
│   └── index.js            # Main application entry point
├── docs/                   # Documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── DEPENDENCIES.md
├── tests/                  # Test files
├── dist/                   # Built files
├── index.html              # Entry point
├── package.json
├── vite.config.js
└── .gitignore
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`
4. Build for production: `npm run build`

## Usage

[Detailed usage instructions will be added here]

## Auditability

All JavaScript code is unminified and thoroughly commented. The application maintains:
- Detailed processing logs
- Clear separation of concerns
- Well-documented API
- Comprehensive error handling

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Deployment

This application can be deployed as a static site to Vercel for easy hosting and sharing. The client-side architecture makes it ideal for static hosting platforms.

### Vercel Deployment

For detailed deployment instructions, see:
- [Full Vercel Deployment Tutorial](docs/DEPLOY_TO_VERCEL.md) - Step-by-step guide for deploying to Vercel
- [Vercel Deployment Cheatsheet](docs/VERCEL_DEPLOYMENT_CHEATSHEET.md) - Quick reference for common deployment tasks

The deployment process is straightforward since the application is entirely client-side and doesn't require any backend services or server-side rendering.

## License

[License information to be added]