#!/usr/bin/env node

/**
 * PDF Text Extractor
 * 
 * This script extracts text content from PDF files.
 * Reads a text file containing PDF file paths (one per line) and processes each PDF,
 * saving its text content to a separate output file in a timestamped directory.
 * 
 * Usage:
 *     node pdf_extractor.js path/to/your/list.txt
 * 
 * Output:
 *     Creates a directory named 'pdf_extracts_YYYYMMDD_HHMMSS' containing all extracted text files
 * 
 * Requirements:
 *     npm install pdf-parse fs-extra
 */

const fs = require('fs-extra');
const path = require('path');
const pdf = require('pdf-parse');

async function extractTextFromPdfFile(pdfPath) {
    try {
        const dataBuffer = await fs.readFile(pdfPath);
        const data = await pdf(dataBuffer);
        return data.text.trim();
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Error: File not found at '${pdfPath}'`);
        } else {
            console.log(`Error processing PDF: ${error.message}`);
        }
        return null;
    }
}

async function processPdfList(fileListPath) {
    try {
        // Read and parse the input file
        const content = await fs.readFile(fileListPath, 'utf8');
        const pdfPaths = content.split('\n').filter(line => line.trim());

        // Create data directory if it doesn't exist
        await fs.ensureDir('data');

        // Create timestamped output directory inside data folder
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T').join('_').slice(0, 15);
        const outputDir = path.join('data', `pdf_extracts_${timestamp}`);
        await fs.ensureDir(outputDir);

        let successCount = 0;
        console.log(`\nProcessing ${pdfPaths.length} files...`);
        console.log(`Output directory: ${outputDir}`);

        const totalStartTime = Date.now();

        for (let i = 0; i < pdfPaths.length; i++) {
            const pdfPath = pdfPaths[i];
            const startTime = Date.now();
            console.log(`\nProcessing file ${i + 1}/${pdfPaths.length}: ${pdfPath}`);

            const extractedText = await extractTextFromPdfFile(pdfPath);

            if (extractedText) {
                // Generate output filename from last 5 parts of the path
                const pathParts = pdfPath.replace(/\\/g, '/').split('/');
                const lastParts = pathParts.slice(-5);
                const baseName = lastParts.join('-').replace(/\.pdf$/i, '');
                const outputFilename = path.join(outputDir, `${baseName}.txt`);

                // Save to file
                await fs.writeFile(outputFilename, extractedText, 'utf8');

                const elapsedTime = (Date.now() - startTime) / 1000;
                console.log(`Text saved to '${outputFilename}'\nCompleted in ${elapsedTime.toFixed(2)} seconds.`);
                successCount++;
            } else {
                const elapsedTime = (Date.now() - startTime) / 1000;
                console.log(`Failed after ${elapsedTime.toFixed(2)} seconds: ${pdfPath}`);
            }
        }

        const totalTime = (Date.now() - totalStartTime) / 1000;
        console.log(`\nProcessing complete. Successfully processed ${successCount} out of ${pdfPaths.length} files.`);
        console.log(`Total processing time: ${totalTime.toFixed(2)} seconds`);
        console.log(`All output files are in directory: ${outputDir}`);

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Error: File list not found at '${fileListPath}'`);
        } else {
            console.log(`Error processing file list: ${error.message}`);
        }
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.log('Usage: node pdf_extractor.js <path_to_file_list>');
        process.exit(1);
    }

    processPdfList(args[0]).catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
} 